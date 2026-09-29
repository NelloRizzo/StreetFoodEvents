import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { BlogCategoryModel } from '../models/blog-category.model';
import { BlogCommentModel } from '../models/blog-comment.model';
import { BlogPostModel, type BlogPostStatus } from '../models/blog-post.model';
import { RoleModel } from '../models/role.model';
import { UserModel } from '../models/user.model';
import { UserRoleModel } from '../models/user-role.model';
import { deleteImage } from '../services/cloudinary-upload.service';
import { sanitizeBlogHtml } from '../utils/html-sanitizer';

/* Chi puo' fare cosa.
 * - writer       : scrive e modifica le notizie
 * - blog-admin   : + elimina, gestisce categorie, pin e moderazione commenti
 * - platform-admin: tutto
 * Le route applicano hasRole([...]) per il guard di base; i privilegi
 * "da blog-admin" (pin, delete, categorie, commenti) sono verificati qui
 * perche' condividono la stessa route PATCH dei writer.
 */
const BLOG_MANAGER_ROLES = ['blog-admin', 'platform-admin'];

const isValidObjectId = (value: unknown): value is string =>
    typeof value === 'string' && Types.ObjectId.isValid(value);

async function isBlogManager(userId: string): Promise<boolean> {
    const roleIds = await RoleModel.find({ slug: { $in: BLOG_MANAGER_ROLES }, isActive: true }).distinct('_id');
    if (roleIds.length === 0) return false;
    const link = await UserRoleModel.findOne({ userId, roleId: { $in: roleIds }, isActive: true }).select('_id');
    return !!link;
}

/* ---------------- slug ---------------- */

function slugify(input: string): string {
    return input
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')   // via gli accenti
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 200);
}

/* Slug unico: se esiste gia' appende -2, -3, ... Il post-esistenza e' con
 * excludeId perche' in fase di update lo slug corrente dell'articolo non
 * deve contare come conflitto. */
async function uniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title) || 'notizia';
    let candidate = base;
    let suffix = 2;

    while (
        await BlogPostModel.exists({
            slug: candidate,
            ...(excludeId ? { _id: { $ne: excludeId } } : {})
        })
    ) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
    }

    return candidate;
}

/* ---------------- serializzazione ---------------- */

type PostSource = {
    _id: Types.ObjectId;
    title: string;
    slug: string;
    excerpt: string | null;
    contentHtml: string;
    coverImage: BlogPostSourceImage | null;
    categoryId: unknown;
    eventId: unknown;
    authorUserId: unknown;
    isPinned: boolean;
    pinnedAt: Date | null;
    status: string;
    publishedAt: Date | null;
    viewCount: number;
    commentCount: number;
    createdAt: Date;
    updatedAt: Date;
};

type BlogPostSourceImage = { url: string; publicId: string; width?: number; height?: number } | null;

function refToId(value: unknown): string | null {
    if (value && typeof value === 'object' && '_id' in value) {
        return (value as { _id: Types.ObjectId })._id.toString();
    }
    return null;
}

function toPostResponse(post: PostSource, options: { includeContent: boolean }) {
    return {
        id: post._id.toString(),
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        /* Nelle liste l'HTML del corpo non serve: pesa e non viene
           renderizzato. Nell'elenco e' gia' sanificato in scrittura. */
        contentHtml: options.includeContent ? post.contentHtml : undefined,
        coverImage: post.coverImage,
        category: post.categoryId
            ? {
                id: refToId(post.categoryId),
                name: (post.categoryId as { name?: string }).name ?? null,
                slug: (post.categoryId as { slug?: string }).slug ?? null,
                color: (post.categoryId as { color?: string | null }).color ?? null
            }
            : null,
        event: post.eventId
            ? {
                id: refToId(post.eventId),
                name: (post.eventId as { name?: string }).name ?? null,
                startDate: (post.eventId as { startDate?: Date }).startDate ?? null,
                endDate: (post.eventId as { endDate?: Date }).endDate ?? null,
                coverImage: (post.eventId as { coverImage?: BlogPostSourceImage }).coverImage ?? null,
                logo: (post.eventId as { logo?: BlogPostSourceImage }).logo ?? null
            }
            : null,
        author: post.authorUserId
            ? {
                id: refToId(post.authorUserId),
                name: authorName(post.authorUserId)
            }
            : null,
        isPinned: post.isPinned,
        pinnedAt: post.pinnedAt,
        status: post.status,
        publishedAt: post.publishedAt,
        viewCount: post.viewCount ?? 0,
        commentCount: post.commentCount ?? 0,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
    };
}

function authorName(value: unknown): string {
    const author = value as { firstName?: string; lastName?: string } | null;
    if (!author) return 'Redazione';
    const full = `${author.firstName ?? ''} ${author.lastName ?? ''}`.trim();
    return full || 'Redazione';
}

function toCategoryResponse(category: InstanceType<typeof BlogCategoryModel>) {
    return {
        id: category._id.toString(),
        name: category.name,
        slug: category.slug,
        description: category.description,
        color: category.color
    };
}

function toCommentResponse(
    comment: InstanceType<typeof BlogCommentModel>,
    options: { includeUser: boolean }
) {
    return {
        id: comment._id.toString(),
        postId: comment.postId.toString(),
        authorName: comment.authorName,
        body: comment.body,
        status: comment.status,
        createdAt: comment.createdAt,
        ...(options.includeUser ? { userId: comment.userId.toString() } : {})
    };
}

const listPopulate = [
    { path: 'categoryId', select: 'name slug color' },
    { path: 'eventId', select: 'name startDate endDate coverImage logo' },
    { path: 'authorUserId', select: 'firstName lastName' }
];

/* Ricalcola il contatore commenti di un post.
 * Ricalcolato (e non incrementato) perche' dopo un hide o una delete il
 * conteggio deve tornare coerente: un $inc andrebbe compensato a mano e
 * drifting sui dati e' molto piu' difficile da notare di un recount.
 */
async function syncCommentCount(postId: Types.ObjectId) {
    const count = await BlogCommentModel.countDocuments({ postId, status: 'visible' });
    await BlogPostModel.updateOne({ _id: postId }, { $set: { commentCount: count } });
    return count;
}

/* =========================== PUBBLICO =========================== */

export async function listPublicPosts(req: Request, res: Response) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const { category, eventId, search } = req.query;

    const filter: Record<string, unknown> = { status: 'published' };

    if (typeof category === 'string' && category) {
        filter.categoryId = await resolveCategoryId(category);
    }
    if (typeof eventId === 'string' && eventId) {
        filter.eventId = isValidObjectId(eventId) ? eventId : null;
    }
    if (typeof search === 'string' && search.trim()) {
        const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [
            { title: new RegExp(safe, 'i') },
            { excerpt: new RegExp(safe, 'i') }
        ];
    }

    const [items, total] = await Promise.all([
        BlogPostModel.find(filter)
            .populate(listPopulate)
            .sort({ isPinned: -1, pinnedAt: -1, publishedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        BlogPostModel.countDocuments(filter)
    ]);

    return res.status(200).json({
        items: items.map((post) => toPostResponse(post as unknown as PostSource, { includeContent: false })),
        total,
        page,
        limit,
        hasMore: page * limit < total
    });
}

/* Aside della home: TUTTE le notizie pinnate (in testa, dalla piu' recente
 * pin) + le ultime 5 pubblicate, senza duplicati.
 *
 * Il de-duplicato conta: una notizia pinnata che rientra anche nelle 5
 * piu' recenti resterebbe altrimenti listata due volte, con lo stesso
 * titolo e lo stesso link, nella stessa colonna. */
export async function listHomePosts(_req: Request, res: Response) {
    const [pinned, latest] = await Promise.all([
        BlogPostModel.find({ status: 'published', isPinned: true })
            .populate(listPopulate)
            .sort({ pinnedAt: -1, publishedAt: -1 }),
        BlogPostModel.find({ status: 'published' })
            .populate(listPopulate)
            .sort({ publishedAt: -1 })
            .limit(5)
    ]);

    const seen = new Set(pinned.map((post) => post._id.toString()));
    const items = [
        ...pinned,
        ...latest.filter((post) => !seen.has(post._id.toString()))
    ];

    return res.status(200).json({
        items: items.map((post) => toPostResponse(post as unknown as PostSource, { includeContent: false }))
    });
}

async function resolveCategoryId(value: string): Promise<Types.ObjectId | null> {
    if (Types.ObjectId.isValid(value)) {
        return new Types.ObjectId(value);
    }
    const found = await BlogCategoryModel.findOne({ slug: value.toLowerCase() }).select('_id');
    return found ? found._id : null;
}

export async function getPublicPost(req: Request, res: Response) {
    const { slug } = req.params;
    const post = await BlogPostModel.findOne({ slug, status: 'published' });

    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }

    /* Difesa in profondita: la sanificazione in scrittura e' il primo filtro,
     * ma qui si ripete all'uscita cosi' l'invariante "ogni link apre in nuova
     * scheda" resta vera anche per righe scritte altrove (import, seed,
     * fix manuali). Costa una passata di sanitize-html per lettura. */
    const safeHtml = sanitizeBlogHtml(post.contentHtml) ?? '';

    /* Contatore visualizzazioni: best-effort, non deve far fallire la
     * lettura del post se il counter non e' aggiornabile. */
    const withCount = await BlogPostModel
        .findByIdAndUpdate(post._id, { $inc: { viewCount: 1 } }, { new: true })
        .populate(listPopulate)
        .catch(() => null);
    const source = (withCount ?? post) as unknown as PostSource;

    return res.status(200).json({
        item: {
            ...toPostResponse(source, { includeContent: false }),
            contentHtml: safeHtml
        }
    });
}

export async function listPublicCategories(_req: Request, res: Response) {
    const items = await BlogCategoryModel.find().sort({ name: 1 });
    return res.status(200).json({ items: items.map(toCategoryResponse) });
}

export async function listPostComments(req: Request, res: Response) {
    const { slug } = req.params;
    const post = await BlogPostModel.findOne({ slug, status: 'published' }).select('_id');
    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }

    const items = await BlogCommentModel.find({ postId: post._id, status: 'visible' })
        .sort({ createdAt: 1 })
        .limit(500);

    return res.status(200).json({
        items: items.map((comment) => toCommentResponse(comment, { includeUser: false }))
    });
}

export async function createComment(req: Request, res: Response) {
    const { slug } = req.params;
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';

    if (!body) {
        return res.status(400).json({ message: 'Comment body is required' });
    }
    if (body.length > 2000) {
        return res.status(400).json({ message: 'Comment is too long' });
    }

    const post = await BlogPostModel.findOne({ slug, status: 'published' }).select('_id');
    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }

    const existing = await BlogCommentModel.findOne({ postId: post._id, userId: req.user!.id });
    if (existing) {
        return res.status(409).json({ message: 'Hai gia\' commentato questa notizia' });
    }

    const user = req.user!;
    /* req.user porta solo id/email: il nome mostrato nel commento si prende
     * dal profilo, cosi' un utente senza nome non finisce col nome grezzo
     * dell'email. */
    const profile = await UserModel.findById(user.id).select('firstName lastName').lean();
    const displayName = `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() || user.email;

    const comment = await BlogCommentModel.create({
        postId: post._id,
        userId: user.id,
        authorName: displayName,
        body
    });

    await syncCommentCount(post._id);

    return res.status(201).json({ item: toCommentResponse(comment, { includeUser: false }) });
}

/* =========================== GESTIONE =========================== */

export async function listManagePosts(req: Request, res: Response) {
    const { status, category, eventId, search } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const filter: Record<string, unknown> = {};
    if (status === 'draft' || status === 'published') {
        filter.status = status;
    }
    if (typeof category === 'string' && category) {
        filter.categoryId = await resolveCategoryId(category);
    }
    if (typeof eventId === 'string' && eventId) {
        filter.eventId = isValidObjectId(eventId) ? eventId : null;
    }
    if (typeof search === 'string' && search.trim()) {
        const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.title = new RegExp(safe, 'i');
    }

    const [items, total] = await Promise.all([
        BlogPostModel.find(filter)
            .populate(listPopulate)
            .sort({ isPinned: -1, pinnedAt: -1, updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        BlogPostModel.countDocuments(filter)
    ]);

    return res.status(200).json({
        items: items.map((post) => toPostResponse(post as unknown as PostSource, { includeContent: false })),
        total,
        page,
        limit
    });
}

function parseStatus(value: unknown): BlogPostStatus | null {
    return value === 'draft' || value === 'published' ? value : null;
}

export async function createPost(req: Request, res: Response) {
    const { title, contentHtml, excerpt, categoryId, eventId } = req.body ?? {};

    if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ message: 'Title is required' });
    }
    /* Si salva il contenuto SANIFICATO, non quello ricevuto: validare e poi
     * archiviare l'originale lascerebbe in banca <script> e javascript:. */
    const sanitizedContent = typeof contentHtml === 'string' ? sanitizeBlogHtml(contentHtml) : null;
    if (!sanitizedContent) {
        return res.status(400).json({ message: 'Content is required' });
    }
    if (categoryId && !isValidObjectId(categoryId)) {
        return res.status(400).json({ message: 'Invalid category' });
    }
    if (eventId && !isValidObjectId(eventId)) {
        return res.status(400).json({ message: 'Invalid event' });
    }

    const status = parseStatus(req.body.status) ?? 'draft';

    const post = await BlogPostModel.create({
        title: title.trim(),
        slug: await uniqueSlug(title),
        excerpt: typeof excerpt === 'string' && excerpt.trim() ? excerpt.trim() : null,
        contentHtml: sanitizedContent,
        coverImage: req.body.coverImage ?? null,
        categoryId: categoryId || null,
        eventId: eventId || null,
        authorUserId: req.user!.id,
        status,
        publishedAt: status === 'published' ? new Date() : null,
        /* Il pin e' una decisione di curatela: nasce sempre disattivato
         * anche se il writer lo chiede nel body, e si imposta via PATCH. */
        isPinned: false
    });

    const populated = await BlogPostModel.findById(post._id).populate(listPopulate);
    return res.status(201).json({
        item: toPostResponse(populated as unknown as PostSource, { includeContent: true })
    });
}

export async function getManagePost(req: Request, res: Response) {
    const { postId } = req.params;
    if (!isValidObjectId(postId)) {
        return res.status(400).json({ message: 'Invalid post id' });
    }

    const post = await BlogPostModel.findById(postId).populate(listPopulate);
    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }

    /* Diversamente dall'endpoint pubblico: niente filtro su status (serve
     * aprire anche le bozze) e niente incremento delle visualizzazioni
     * (sono visite di redazione, non letture del pubblico). */
    return res.status(200).json({
        item: toPostResponse(post as unknown as PostSource, { includeContent: true })
    });
}

export async function updatePost(req: Request, res: Response) {
    const { postId } = req.params;
    if (!isValidObjectId(postId)) {
        return res.status(400).json({ message: 'Invalid post id' });
    }

    const post = await BlogPostModel.findById(postId);
    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }

    const body = req.body ?? {};

    /* Il pin e' riservato ai blog-admin: la stessa route serve anche i
     * writer, che non devono poter spostare in cima le notizie altrui. */
    if (typeof body.isPinned === 'boolean' && body.isPinned !== post.isPinned) {
        if (!(await isBlogManager(req.user!.id))) {
            return res.status(403).json({ message: 'Solo un blog-admin puo\' pinnare le notizie' });
        }
        post.isPinned = body.isPinned;
        post.pinnedAt = body.isPinned ? new Date() : null;
    }

    if (typeof body.title === 'string' && body.title.trim()) {
        const nextTitle = body.title.trim();
        if (nextTitle !== post.title) {
            /* Cambio titolo -> rigenera lo slug, cosi' l'URL resta leggibile.
             * I vecchi link non re-direzionano: se serve, si aggiunge un
             * alias (vedi TODO.md). */
            post.title = nextTitle;
            post.slug = await uniqueSlug(nextTitle, postId);
        }
    }

    if (typeof body.excerpt === 'string' || body.excerpt === null) {
        post.excerpt = typeof body.excerpt === 'string' && body.excerpt.trim() ? body.excerpt.trim() : null;
    }

    if (typeof body.contentHtml === 'string') {
        const sanitized = sanitizeBlogHtml(body.contentHtml);
        if (!sanitized) {
            return res.status(400).json({ message: 'Content is required' });
        }
        post.contentHtml = sanitized;
    }

    if (body.coverImage !== undefined) {
        const next = body.coverImage;
        if (next === null || (typeof next === 'object' && typeof (next as { url?: string }).url === 'string')) {
            post.coverImage = next;
        }
    }

    if (body.categoryId !== undefined) {
        if (body.categoryId === null) {
            post.categoryId = null;
        } else if (isValidObjectId(body.categoryId)) {
            const category = await BlogCategoryModel.findById(body.categoryId).select('_id');
            if (!category) {
                return res.status(400).json({ message: 'Category not found' });
            }
            post.categoryId = category._id;
        } else {
            return res.status(400).json({ message: 'Invalid category' });
        }
    }

    if (body.eventId !== undefined) {
        if (body.eventId === null) {
            post.eventId = null;
        } else if (isValidObjectId(body.eventId)) {
            post.eventId = body.eventId;
        } else {
            return res.status(400).json({ message: 'Invalid event' });
        }
    }

    const nextStatus = parseStatus(body.status);
    if (nextStatus && nextStatus !== post.status) {
        post.status = nextStatus;
        /* Ogni passaggio a published rimette in alto la notizia: la
         * cronologia del blog e' "quando e' stata pubblicata", quindi un
         * articolo depubblicato e ripubblicato deve tornare in testa. */
        post.publishedAt = nextStatus === 'published' ? new Date() : null;
    }

    await post.save();

    const populated = await BlogPostModel.findById(post._id).populate(listPopulate);
    return res.status(200).json({
        item: toPostResponse(populated as unknown as PostSource, { includeContent: true })
    });
}

export async function deletePost(req: Request, res: Response) {
    const { postId } = req.params;
    if (!isValidObjectId(postId)) {
        return res.status(400).json({ message: 'Invalid post id' });
    }

    const post = await BlogPostModel.findByIdAndDelete(postId);
    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }

    /* I commenti del post vanno via con il post. Gli asset inline del
     * corpo sono immagini dentro l'HTML (non abbiamo il publicId per
     * elencarli): vengono gestiti da Cloudinary. Si rimuove solo la cover. */
    await BlogCommentModel.deleteMany({ postId: post._id }).catch(() => {});
    if (post.coverImage?.publicId) {
        await deleteImage(post.coverImage.publicId).catch(() => {});
    }

    return res.status(204).send();
}

/* ---------------- categorie ---------------- */

export async function listManageCategories(_req: Request, res: Response) {
    const items = await BlogCategoryModel.find().sort({ name: 1 });
    return res.status(200).json({ items: items.map(toCategoryResponse) });
}

export async function createCategory(req: Request, res: Response) {
    const { name, description, color, slug } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Name is required' });
    }

    const finalSlug = typeof slug === 'string' && slug.trim()
        ? slugify(slug)
        : await uniqueCategorySlug(name);

    if (!finalSlug) {
        return res.status(400).json({ message: 'Slug non valido' });
    }
    if (await BlogCategoryModel.exists({ slug: finalSlug })) {
        return res.status(409).json({ message: 'Esiste gia\' una categoria con questo slug' });
    }

    const item = await BlogCategoryModel.create({
        name: name.trim(),
        slug: finalSlug,
        description: typeof description === 'string' && description.trim() ? description.trim() : null,
        color: typeof color === 'string' && color.trim() ? color.trim() : null
    });

    return res.status(201).json({ item: toCategoryResponse(item) });
}

async function uniqueCategorySlug(name: string): Promise<string> {
    const base = slugify(name) || 'categoria';
    let candidate = base;
    let suffix = 2;
    while (await BlogCategoryModel.exists({ slug: candidate })) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
    }
    return candidate;
}

export async function updateCategory(req: Request, res: Response) {
    const { categoryId } = req.params;
    if (!isValidObjectId(categoryId)) {
        return res.status(400).json({ message: 'Invalid category id' });
    }

    const category = await BlogCategoryModel.findById(categoryId);
    if (!category) {
        return res.status(404).json({ message: 'Category not found' });
    }

    const { name, description, color, slug } = req.body ?? {};

    if (typeof name === 'string' && name.trim()) {
        category.name = name.trim();
    }
    if (typeof description === 'string' || description === null) {
        category.description = typeof description === 'string' && description.trim() ? description.trim() : null;
    }
    if (typeof color === 'string' || color === null) {
        category.color = typeof color === 'string' && color.trim() ? color.trim() : null;
    }
    if (typeof slug === 'string' && slug.trim()) {
        const nextSlug = slugify(slug);
        if (!nextSlug) {
            return res.status(400).json({ message: 'Slug non valido' });
        }
        if (await BlogCategoryModel.exists({ slug: nextSlug, _id: { $ne: category._id } })) {
            return res.status(409).json({ message: 'Esiste gia\' una categoria con questo slug' });
        }
        category.slug = nextSlug;
    }

    await category.save();
    return res.status(200).json({ item: toCategoryResponse(category) });
}

export async function deleteCategory(req: Request, res: Response) {
    const { categoryId } = req.params;
    if (!isValidObjectId(categoryId)) {
        return res.status(400).json({ message: 'Invalid category id' });
    }

    const category = await BlogCategoryModel.findByIdAndDelete(categoryId);
    if (!category) {
        return res.status(404).json({ message: 'Category not found' });
    }

    /* Le notizie non vengono cancellate: la categoria si stacca e restano
     * pubblicabili senza categoria. */
    await BlogPostModel.updateMany({ categoryId: category._id }, { $set: { categoryId: null } });

    return res.status(204).send();
}

/* ---------------- commenti (moderazione) ---------------- */

export async function listManageComments(req: Request, res: Response) {
    const filter: Record<string, unknown> = {};
    if (isValidObjectId(req.query.postId)) {
        filter.postId = req.query.postId;
    }
    if (req.query.status === 'visible' || req.query.status === 'hidden') {
        filter.status = req.query.status;
    }

    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const items = await BlogCommentModel.find(filter)
        .populate('postId', 'title slug')
        .sort({ createdAt: -1 })
        .limit(limit);

    return res.status(200).json({
        items: items.map((comment) => {
            const post = comment.postId as unknown as { title?: string; slug?: string };
            return {
                ...toCommentResponse(comment, { includeUser: true }),
                post: post && post.title ? { title: post.title, slug: post.slug } : null
            };
        })
    });
}

export async function updateCommentStatus(req: Request, res: Response) {
    const { commentId } = req.params;
    const { status } = req.body ?? {};

    if (!isValidObjectId(commentId)) {
        return res.status(400).json({ message: 'Invalid comment id' });
    }
    if (status !== 'visible' && status !== 'hidden') {
        return res.status(400).json({ message: 'Invalid status' });
    }

    const comment = await BlogCommentModel.findByIdAndUpdate(commentId, { $set: { status } }, { new: true });
    if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
    }

    await syncCommentCount(comment.postId);
    return res.status(200).json({ item: toCommentResponse(comment, { includeUser: true }) });
}

export async function deleteComment(req: Request, res: Response) {
    const { commentId } = req.params;
    if (!isValidObjectId(commentId)) {
        return res.status(400).json({ message: 'Invalid comment id' });
    }

    const comment = await BlogCommentModel.findByIdAndDelete(commentId);
    if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
    }

    await syncCommentCount(comment.postId);
    return res.status(204).send();
}
