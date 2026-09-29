import * as argon2 from 'argon2';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/cloudinary', () => ({
    cloudinary: {
        upload: { stream: vi.fn() },
        api: { delete_resources: vi.fn() }
    }
}));

const deleteImageMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/services/cloudinary-upload.service', () => ({
    deleteImage: (...args: unknown[]) => deleteImageMock(...args),
    deleteMedia: vi.fn().mockResolvedValue(undefined),
    deleteImages: vi.fn().mockResolvedValue(undefined),
    uploadImageBuffer: vi.fn().mockResolvedValue({
        url: 'https://cloudinary.test/x.jpg',
        publicId: 'x-1',
        width: 800,
        height: 600,
        format: 'jpg',
        bytes: 1234
    })
}));

import { BlogCategoryModel } from '../../models/blog-category.model';
import { BlogCommentModel } from '../../models/blog-comment.model';
import { BlogPostModel } from '../../models/blog-post.model';
import { EventModel } from '../../models/event.model';
import { RoleModel } from '../../models/role.model';
import { SessionModel } from '../../models/session.model';
import { UserModel } from '../../models/user.model';
import { UserRoleModel } from '../../models/user-role.model';
import { generateSessionToken, getSessionExpiryDate, hashSessionToken } from '../../utils/session';
import { createTestApp } from '../helpers/test-app';

let app: Express;

async function createAuthSession(firstName = 'Test', lastName = 'Utente') {
    const user = await UserModel.create({
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}-${Date.now()}-${Math.random().toString(16).slice(2)}@test.com`,
        passwordHash: await argon2.hash('Password123!'),
        isActive: true
    });

    const sessionToken = generateSessionToken();
    await SessionModel.create({
        userId: user._id,
        tokenHash: hashSessionToken(sessionToken),
        expiresAt: getSessionExpiryDate(),
        lastActivityAt: new Date()
    });

    return { user, sessionToken };
}

async function assignRole(userId: string, slug: string, scope: 'platform' | 'event' | 'stand') {
    const role = await RoleModel.create({
        name: slug,
        slug,
        scope,
        permissions: ['manage']
    });
    await UserRoleModel.create({ userId, roleId: role._id, isActive: true });
}

async function createEvent() {
    return EventModel.create({
        name: 'Festa di prova',
        location: { label: 'Piazza Roma', city: 'Roma' },
        startDate: new Date(),
        endDate: new Date()
    });
}

async function createPost(overrides: Record<string, unknown> = {}) {
    return BlogPostModel.create({
        title: 'Notizia di prova',
        slug: `notizia-${Math.random().toString(16).slice(2, 8)}`,
        excerpt: 'Sommario',
        contentHtml: '<p>Testo</p>',
        status: 'published',
        publishedAt: new Date(),
        ...overrides
    });
}

beforeEach(async () => {
    app = createTestApp();
});

describe('blog — lettura pubblica', () => {
    it('lista solo le notizie pubblicate, con le pinnate in testa', async () => {
        await createPost({ title: 'Pubblicata A', publishedAt: new Date('2026-01-01') });
        const toPin = await createPost({ title: 'Pubblicata B', publishedAt: new Date('2026-01-02') });
        await createPost({ title: 'Bozza', status: 'draft', publishedAt: null });

        await BlogPostModel.updateOne({ _id: toPin._id }, { isPinned: true, pinnedAt: new Date() });

        const res = await request(app).get('/api/blog');
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(2);
        expect(res.body.items[0].title).toBe('Pubblicata B');
        expect(res.body.items[0].isPinned).toBe(true);
        expect(res.body.items.map((p: { title: string }) => p.title)).not.toContain('Bozza');
    });

    it('non espone il corpo HTML nelle liste (solo excerpt)', async () => {
        await createPost({ contentHtml: '<p>Corpo riservato</p>' });
        const res = await request(app).get('/api/blog');
        expect(res.status).toBe(200);
        expect(res.body.items[0].contentHtml).toBeUndefined();
        expect(res.body.items[0].excerpt).toBe('Sommario');
    });

    it('filtra per categoria e per evento', async () => {
        const category = await BlogCategoryModel.create({ name: 'Eventi', slug: 'eventi' });
        const other = await BlogCategoryModel.create({ name: 'Tech', slug: 'tech' });
        const event = await createEvent();

        await createPost({ title: 'A', categoryId: category._id, eventId: event._id });
        await createPost({ title: 'B', categoryId: other._id });

        const byCategory = await request(app).get('/api/blog?category=eventi');
        expect(byCategory.body.items).toHaveLength(1);
        expect(byCategory.body.items[0].title).toBe('A');

        const byEvent = await request(app).get(`/api/blog?eventId=${event._id}`);
        expect(byEvent.body.items).toHaveLength(1);
        expect(byEvent.body.items[0].title).toBe('A');
    });

    it('apre il dettaglio incrementando le visualizzazioni e restituisce il corpo', async () => {
        const post = await createPost({ contentHtml: '<p>Corpo</p>' });
        const res = await request(app).get(`/api/blog/${post.slug}`);
        expect(res.status).toBe(200);
        expect(res.body.item.contentHtml).toContain('Corpo');
        expect(res.body.item.viewCount).toBe(1);
    });

    it('non serve una bozza pubblicata per slug', async () => {
        const draft = await createPost({ status: 'draft', publishedAt: null });
        const res = await request(app).get(`/api/blog/${draft.slug}`);
        expect(res.status).toBe(404);
    });

    it('in gestione apre anche le bozze, col corpo e senza contare la vista', async () => {
        const { user, sessionToken } = await createAuthSession('Red', 'Apre');
        await assignRole(user._id.toString(), 'writer', 'platform');
        const draft = await createPost({ status: 'draft', publishedAt: null, contentHtml: '<p>Corpo bozza</p>' });

        const res = await request(app)
            .get(`/api/blog/manage/posts/${draft._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(200);
        expect(res.body.item.contentHtml).toContain('Corpo bozza');
        expect(res.body.item.status).toBe('draft');
        expect(res.body.item.viewCount).toBe(0);
    });
});

describe('blog — aside della home', () => {
    it('restituisce le 5 ultime, con le pinnate in testa e senza duplicati', async () => {
        for (let i = 1; i <= 7; i += 1) {
            await createPost({ title: `Notizia ${i}`, publishedAt: new Date(2026, 0, i) });
        }

        /* La 6 piu' recente (Notizia 6) e' anche pinnata: compare una volta
         * sola, in testa, e non aggiunge un sesto elemento. */
        const six = await BlogPostModel.findOne({ title: 'Notizia 6' });
        await BlogPostModel.updateOne({ _id: six!._id }, { isPinned: true, pinnedAt: new Date() });

        const res = await request(app).get('/api/blog/home');
        expect(res.status).toBe(200);

        const titles = res.body.items.map((p: { title: string }) => p.title);
        expect(titles[0]).toBe('Notizia 6');
        expect(titles.filter((t: string) => t === 'Notizia 6')).toHaveLength(1);
        expect(res.body.items).toHaveLength(5);
    });

    it('aggiunge le pinnate che sono FUORI dalle 5 ultime', async () => {
        for (let i = 1; i <= 6; i += 1) {
            await createPost({ title: `Notizia ${i}`, publishedAt: new Date(2026, 0, i) });
        }
        /* Notizia 1 e' la piu' vecchia: pinnata, deve comunque finire in
         * testa, e questo si somma alle 5 ultime. */
        const old = await BlogPostModel.findOne({ title: 'Notizia 1' });
        await BlogPostModel.updateOne({ _id: old!._id }, { isPinned: true, pinnedAt: new Date() });

        const res = await request(app).get('/api/blog/home');
        const titles = res.body.items.map((p: { title: string }) => p.title);
        expect(titles[0]).toBe('Notizia 1');
        expect(titles).toHaveLength(6);
    });

    it('non include le bozze pinnate', async () => {
        const draft = await createPost({ title: 'Bozza', status: 'draft', publishedAt: null });
        await BlogPostModel.updateOne({ _id: draft._id }, { isPinned: true, pinnedAt: new Date() });
        const res = await request(app).get('/api/blog/home');
        expect(res.body.items).toHaveLength(0);
    });
});

describe('blog — i link del corpo aprono in nuova scheda', () => {
    it('sanifica il corpo e forza _blank anche su link preesistenti o malevoli', async () => {
        const { user, sessionToken } = await createAuthSession('Admin', 'Blog');
        await assignRole(user._id.toString(), 'platform-admin', 'platform');
        const cookie = `sid=${sessionToken}`;

        const created = await request(app)
            .post('/api/blog/manage/posts')
            .set('Cookie', cookie)
            .send({
                title: 'Notizia con link',
                contentHtml:
                    '<p>Testo <a href="https://example.com">uno</a> ' +
                    '<a href="https://example.org" target="_self" rel="dofollow">due</a> ' +
                    '<a href="javascript:alert(1)">tre</a></p><script>alert(1)</script>'
            });

        expect(created.status).toBe(201);
        const html = created.body.item.contentHtml;

        /* Ogni ancora aperta in nuova scheda... */
        const anchors = html.match(/<a\b[^>]*>/g) ?? [];
        expect(anchors.length).toBeGreaterThan(0);
        anchors.forEach((tag: string) => {
            expect(tag).toContain('target="_blank"');
            expect(tag).toContain('rel="noopener noreferrer nofollow"');
        });

        /* ...anche quelle che provavano a restare nella stessa scheda... */
        expect(html).not.toContain('target="_self"');
        /* ...e lo script e lo javascript: non passano. */
        expect(html).not.toContain('<script');
        expect(html).not.toContain('javascript:');
    });

    it('forza _blank anche in lettura su righe scritte fuori dall\'API', async () => {
        /* Difesa in profondita: una notizia inserita direttamente in banca
         * (seed, import, fix manuale) non passa da createPost, quindi
         * non e' sanificata in scrittura. La lettura pubblica deve comunque
         * consegnare link in nuova scheda. */
        const raw = await BlogPostModel.create({
            title: 'Riga legacy',
            slug: `legacy-${Math.random().toString(16).slice(2, 8)}`,
            contentHtml: '<p><a href="https://legacy.example">vecchio link</a><script>alert(1)</script></p>',
            status: 'published',
            publishedAt: new Date()
        });

        const res = await request(app).get(`/api/blog/${raw.slug}`);
        expect(res.status).toBe(200);
        expect(res.body.item.contentHtml).toContain('target="_blank"');
        expect(res.body.item.contentHtml).toContain('noopener');
        expect(res.body.item.contentHtml).not.toContain('<script');
    });
});

describe('blog — ruoli: writer scrive, blog-admin gestisce', () => {
    it('un writer puo\' creare una notizia', async () => {
        const { user, sessionToken } = await createAuthSession('Writer', 'Uno');
        await assignRole(user._id.toString(), 'writer', 'platform');

        const res = await request(app)
            .post('/api/blog/manage/posts')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ title: 'Notizia dello writer', contentHtml: '<p>ciao</p>' });

        expect(res.status).toBe(201);
        expect(res.body.item.author.id).toBe(user._id.toString());
    });

    it('un writer NON puo\' pinnare', async () => {
        const { user, sessionToken } = await createAuthSession('Writer', 'Due');
        await assignRole(user._id.toString(), 'writer', 'platform');
        const post = await createPost();

        const res = await request(app)
            .patch(`/api/blog/manage/posts/${post._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ isPinned: true });

        expect(res.status).toBe(403);
        const after = await BlogPostModel.findById(post._id);
        expect(after!.isPinned).toBe(false);
    });

    it('un writer NON puo\' eliminare una notizia', async () => {
        const { user, sessionToken } = await createAuthSession('Writer', 'Tre');
        await assignRole(user._id.toString(), 'writer', 'platform');
        const post = await createPost();

        const res = await request(app)
            .delete(`/api/blog/manage/posts/${post._id}`)
            .set('Cookie', `sid=${sessionToken}`);

        expect(res.status).toBe(403);
        expect(await BlogPostModel.findById(post._id)).not.toBeNull();
    });

    it('un writer NON puo\' creare categorie', async () => {
        const { user, sessionToken } = await createAuthSession('Writer', 'Quattro');
        await assignRole(user._id.toString(), 'writer', 'platform');

        const res = await request(app)
            .post('/api/blog/manage/categories')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ name: 'Rubrica' });

        expect(res.status).toBe(403);
    });

    it('un blog-admin puo\' pinnare ed eliminare', async () => {
        const { user, sessionToken } = await createAuthSession('Blog', 'Admin');
        await assignRole(user._id.toString(), 'blog-admin', 'platform');
        const cookie = `sid=${sessionToken}`;
        const post = await createPost();

        const pin = await request(app)
            .patch(`/api/blog/manage/posts/${post._id}`)
            .set('Cookie', cookie)
            .send({ isPinned: true });
        expect(pin.status).toBe(200);
        expect(pin.body.item.isPinned).toBe(true);
        expect(pin.body.item.pinnedAt).not.toBeNull();

        const del = await request(app)
            .delete(`/api/blog/manage/posts/${post._id}`)
            .set('Cookie', cookie);
        expect(del.status).toBe(204);
    });

    it('un utente senza ruolo blog non puo\' scrivere', async () => {
        const { sessionToken } = await createAuthSession('Semplice', 'Visitatore');
        const res = await request(app)
            .post('/api/blog/manage/posts')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ title: 'Tentativo', contentHtml: '<p>x</p>' });
        expect(res.status).toBe(403);
    });

    it('richiede l\'autenticazione anche per creare', async () => {
        const res = await request(app)
            .post('/api/blog/manage/posts')
            .send({ title: 'Tentativo', contentHtml: '<p>x</p>' });
        expect(res.status).toBe(401);
    });
});

describe('blog — ciclo di vita della notizia', () => {
    it('nasce come bozza e la pubblicazione fissa publishedAt', async () => {
        const { user, sessionToken } = await createAuthSession('Red', 'Attore');
        await assignRole(user._id.toString(), 'writer', 'platform');
        const cookie = `sid=${sessionToken}`;

        const created = await request(app)
            .post('/api/blog/manage/posts')
            .set('Cookie', cookie)
            .send({ title: 'Bozza', contentHtml: '<p>x</p>' });
        expect(created.status).toBe(201);
        expect(created.body.item.status).toBe('draft');
        expect(created.body.item.publishedAt).toBeNull();

        /* Una bozza non si vede dal pubblico. */
        const publicRes = await request(app).get('/api/blog');
        expect(publicRes.body.items).toHaveLength(0);

        const published = await request(app)
            .patch(`/api/blog/manage/posts/${created.body.item.id}`)
            .set('Cookie', cookie)
            .send({ status: 'published' });
        expect(published.status).toBe(200);
        expect(published.body.item.publishedAt).not.toBeNull();

        const afterPublic = await request(app).get('/api/blog');
        expect(afterPublic.body.items).toHaveLength(1);
    });

    it('ignora un pin richiesto in creazione (decisione di curatela)', async () => {
        const { user, sessionToken } = await createAuthSession('Red', 'Uno');
        await assignRole(user._id.toString(), 'platform-admin', 'platform');

        const res = await request(app)
            .post('/api/blog/manage/posts')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ title: 'Con pin', contentHtml: '<p>x</p>', isPinned: true, status: 'published' });

        expect(res.status).toBe(201);
        expect(res.body.item.isPinned).toBe(false);
    });

    it('genera slug leggibili e li rende unici', async () => {
        const { user, sessionToken } = await createAuthSession('Red', 'Due');
        await assignRole(user._id.toString(), 'writer', 'platform');
        const cookie = `sid=${sessionToken}`;

        const first = await request(app)
            .post('/api/blog/manage/posts')
            .set('Cookie', cookie)
            .send({ title: 'Serata di Via Roma', contentHtml: '<p>x</p>' });
        expect(first.body.item.slug).toBe('serata-di-via-roma');

        const second = await request(app)
            .post('/api/blog/manage/posts')
            .set('Cookie', cookie)
            .send({ title: 'Serata di Via Roma', contentHtml: '<p>x</p>' });
        expect(second.body.item.slug).toBe('serata-di-via-roma-2');
    });

    it('ricollega la notizia a categoria ed evento validi e li stacca con null', async () => {
        const { user, sessionToken } = await createAuthSession('Red', 'Tre');
        await assignRole(user._id.toString(), 'writer', 'platform');
        const cookie = `sid=${sessionToken}`;
        const category = await BlogCategoryModel.create({ name: 'Eventi', slug: 'eventi' });
        const event = await createEvent();
        const post = await createPost();

        const linked = await request(app)
            .patch(`/api/blog/manage/posts/${post._id}`)
            .set('Cookie', cookie)
            .send({ categoryId: category._id.toString(), eventId: event._id.toString() });
        expect(linked.status).toBe(200);
        expect(linked.body.item.category.name).toBe('Eventi');
        expect(linked.body.item.event.name).toBe('Festa di prova');

        const unlinked = await request(app)
            .patch(`/api/blog/manage/posts/${post._id}`)
            .set('Cookie', cookie)
            .send({ categoryId: null, eventId: null });
        expect(unlinked.body.item.category).toBeNull();
        expect(unlinked.body.item.event).toBeNull();
    });

    it('rifiuta una categoria inesistente', async () => {
        const { user, sessionToken } = await createAuthSession('Red', 'Quattro');
        await assignRole(user._id.toString(), 'writer', 'platform');
        const post = await createPost();

        const res = await request(app)
            .patch(`/api/blog/manage/posts/${post._id}`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ categoryId: '64b7f1f0f0f0f0f0f0f0f0f0' });

        expect(res.status).toBe(400);
    });
});

describe('blog — categorie', () => {
    it('crea categorie e detacca le notizie senza cancellarle', async () => {
        const { user, sessionToken } = await createAuthSession('Cat', 'Admin');
        await assignRole(user._id.toString(), 'blog-admin', 'platform');
        const cookie = `sid=${sessionToken}`;

        const category = await request(app)
            .post('/api/blog/manage/categories')
            .set('Cookie', cookie)
            .send({ name: 'Ultime Notizie' });
        expect(category.status).toBe(201);
        expect(category.body.item.slug).toBe('ultime-notizie');

        const post = await createPost({ categoryId: category.body.item.id });
        const del = await request(app)
            .delete(`/api/blog/manage/categories/${category.body.item.id}`)
            .set('Cookie', cookie);
        expect(del.status).toBe(204);

        const stillThere = await BlogPostModel.findById(post._id);
        expect(stillThere).not.toBeNull();
        expect(stillThere!.categoryId).toBeNull();
    });

    it('rende unici gli slug automatici e rifiuta uno slug esplicito duplicato', async () => {
        const { user, sessionToken } = await createAuthSession('Cat', 'Due');
        await assignRole(user._id.toString(), 'blog-admin', 'platform');
        const cookie = `sid=${sessionToken}`;

        const first = await request(app)
            .post('/api/blog/manage/categories')
            .set('Cookie', cookie)
            .send({ name: 'Notizie' });
        expect(first.status).toBe(201);
        expect(first.body.item.slug).toBe('notizie');

        /* stesso nome -> slug automatico disambiguato, non un errore */
        const auto = await request(app)
            .post('/api/blog/manage/categories')
            .set('Cookie', cookie)
            .send({ name: 'notizie' });
        expect(auto.status).toBe(201);
        expect(auto.body.item.slug).toBe('notizie-2');

        /* slug scelto a mano e gia' preso -> 409 */
        const dup = await request(app)
            .post('/api/blog/manage/categories')
            .set('Cookie', cookie)
            .send({ name: 'Altra rubrica', slug: 'notizie' });
        expect(dup.status).toBe(409);
    });

    it('espone le categorie anche al pubblico', async () => {
        await BlogCategoryModel.create({ name: 'Pubblica', slug: 'pubblica' });
        const res = await request(app).get('/api/blog/categories');
        expect(res.status).toBe(200);
        expect(res.body.items[0].slug).toBe('pubblica');
    });
});

describe('blog — commenti', () => {
    it('richiede un utente registrato', async () => {
        const post = await createPost();
        const res = await request(app).post(`/api/blog/${post.slug}/comments`).send({ body: 'Ciao' });
        expect(res.status).toBe(401);
    });

    it('un utente commenta una volta e il contatore si aggiorna', async () => {
        const { user, sessionToken } = await createAuthSession('Luca', 'Verdi');
        const post = await createPost();
        const cookie = `sid=${sessionToken}`;

        const res = await request(app)
            .post(`/api/blog/${post.slug}/comments`)
            .set('Cookie', cookie)
            .send({ body: 'Ottima notizia!' });
        expect(res.status).toBe(201);
        expect(res.body.item.authorName).toBe('Luca Verdi');

        const stored = await BlogPostModel.findById(post._id);
        expect(stored!.commentCount).toBe(1);

        /* secondo commento dello stesso utente sulla stessa notizia -> 409 */
        const dup = await request(app)
            .post(`/api/blog/${post.slug}/comments`)
            .set('Cookie', cookie)
            .send({ body: 'Ancora' });
        expect(dup.status).toBe(409);

        /* lo stesso utente puo' invece commentare un'altra notizia */
        const other = await createPost();
        const otherRes = await request(app)
            .post(`/api/blog/${other.slug}/comments`)
            .set('Cookie', cookie)
            .send({ body: 'Commento qui' });
        expect(otherRes.status).toBe(201);
        expect(user).toBeTruthy();
    });

    it('rifiuta commenti vuoti o troppo lunghi', async () => {
        const { sessionToken } = await createAuthSession('Anna', 'Neri');
        const post = await createPost();
        const cookie = `sid=${sessionToken}`;

        const empty = await request(app).post(`/api/blog/${post.slug}/comments`).set('Cookie', cookie).send({ body: '   ' });
        expect(empty.status).toBe(400);

        const long = await request(app)
            .post(`/api/blog/${post.slug}/comments`)
            .set('Cookie', cookie)
            .send({ body: 'a'.repeat(2001) });
        expect(long.status).toBe(400);
    });

    it('non si commenta una bozza', async () => {
        const { sessionToken } = await createAuthSession('Anna', 'Due');
        const draft = await createPost({ status: 'draft', publishedAt: null });
        const res = await request(app)
            .post(`/api/blog/${draft.slug}/comments`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ body: 'Commento' });
        expect(res.status).toBe(404);
    });

    it('nasconde e poi cancella un commento, aggiornando il contatore', async () => {
        const { user: author, sessionToken: authorToken } = await createAuthSession('Mario', 'Rossi');
        const { user: mod, sessionToken: modToken } = await createAuthSession('Mod', 'Eratore');
        await assignRole(mod._id.toString(), 'blog-admin', 'platform');
        const post = await createPost();

        const created = await request(app)
            .post(`/api/blog/${post.slug}/comments`)
            .set('Cookie', `sid=${authorToken}`)
            .send({ body: 'Commento da moderare' });
        const commentId = created.body.item.id;

        /* il commento e' visibile subito, senza attesa di moderazione */
        const publicList = await request(app).get(`/api/blog/${post.slug}/comments`);
        expect(publicList.body.items).toHaveLength(1);

        const hidden = await request(app)
            .patch(`/api/blog/manage/comments/${commentId}`)
            .set('Cookie', `sid=${modToken}`)
            .send({ status: 'hidden' });
        expect(hidden.status).toBe(200);

        const afterHide = await request(app).get(`/api/blog/${post.slug}/comments`);
        expect(afterHide.body.items).toHaveLength(0);
        const postAfterHide = await BlogPostModel.findById(post._id);
        expect(postAfterHide!.commentCount).toBe(0);

        const del = await request(app)
            .delete(`/api/blog/manage/comments/${commentId}`)
            .set('Cookie', `sid=${modToken}`);
        expect(del.status).toBe(204);
        expect(await BlogCommentModel.findById(commentId)).toBeNull();
        expect(author).toBeTruthy();
    });

    it('un writer non puo\' moderare i commenti', async () => {
        const { user: writer, sessionToken: writerToken } = await createAuthSession('Writer', 'Cinque');
        await assignRole(writer._id.toString(), 'writer', 'platform');
        const { sessionToken: authorToken } = await createAuthSession('Autore', 'Post');
        const post = await createPost();

        const created = await request(app)
            .post(`/api/blog/${post.slug}/comments`)
            .set('Cookie', `sid=${authorToken}`)
            .send({ body: 'Commento' });

        const res = await request(app)
            .delete(`/api/blog/manage/comments/${created.body.item.id}`)
            .set('Cookie', `sid=${writerToken}`);
        expect(res.status).toBe(403);
    });

    it('non espone il userId nei commenti pubblici', async () => {
        const { sessionToken } = await createAuthSession('Pub', 'Blocco');
        const post = await createPost();
        await request(app)
            .post(`/api/blog/${post.slug}/comments`)
            .set('Cookie', `sid=${sessionToken}`)
            .send({ body: 'Ciao' });

        const res = await request(app).get(`/api/blog/${post.slug}/comments`);
        expect(res.body.items[0].userId).toBeUndefined();
    });
});

describe('blog — 404 e validazioni', () => {
    it('404 su slug inesistente', async () => {
        const res = await request(app).get('/api/blog/non-esiste');
        expect(res.status).toBe(404);
    });

    it('400 su id non valido', async () => {
        const { user, sessionToken } = await createAuthSession('Val', 'Id');
        await assignRole(user._id.toString(), 'platform-admin', 'platform');
        const res = await request(app)
            .patch('/api/blog/manage/posts/xyz')
            .set('Cookie', `sid=${sessionToken}`)
            .send({ title: 'x' });
        expect(res.status).toBe(400);
    });

    it('richiede titolo e corpo', async () => {
        const { user, sessionToken } = await createAuthSession('Val', 'Due');
        await assignRole(user._id.toString(), 'writer', 'platform');
        const cookie = `sid=${sessionToken}`;

        const noTitle = await request(app).post('/api/blog/manage/posts').set('Cookie', cookie).send({ contentHtml: '<p>x</p>' });
        expect(noTitle.status).toBe(400);

        const noContent = await request(app).post('/api/blog/manage/posts').set('Cookie', cookie).send({ title: 'Titolo' });
        expect(noContent.status).toBe(400);
    });

    it('le rotte /home e /categories non vengono trattate come slug', async () => {
        const home = await request(app).get('/api/blog/home');
        const categories = await request(app).get('/api/blog/categories');
        expect(home.status).toBe(200);
        expect(home.body.items).toEqual([]);
        expect(categories.status).toBe(200);
    });
});
