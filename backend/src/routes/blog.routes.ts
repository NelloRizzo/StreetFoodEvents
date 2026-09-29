import { Router } from 'express';

import {
    createCategory,
    createComment,
    createPost,
    deleteCategory,
    deleteComment,
    deletePost,
    getManagePost,
    getPublicPost,
    listHomePosts,
    listManageCategories,
    listManageComments,
    listManagePosts,
    listPostComments,
    listPublicCategories,
    listPublicPosts,
    updateCategory,
    updateCommentStatus,
    updatePost
} from '../controllers/blog.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/role.middleware';
import { asyncHandler } from '../utils/async-handler';

/* Scrivere nel blog: writer, blog-admin, platform-admin.
 * Gestire (pin, delete, categorie, moderazione commenti): blog-admin e
 * platform-admin -> guard separato MANAGER_ONLY. */
const WRITER_ROLES = ['writer', 'blog-admin', 'platform-admin'];
const MANAGER_ROLES = ['blog-admin', 'platform-admin'];

export const blogRouter = Router();

/* ---------- pubblico (nessuna auth) ---------- */

/* Registrate PRIMA di '/:slug': altrimenti "home" e "categories" verrebbero
 * mangiati dal parametro e risponderebbero 404 (o peggio, 400 id invalido). */
blogRouter.get('/home', asyncHandler(listHomePosts));
blogRouter.get('/categories', asyncHandler(listPublicCategories));
blogRouter.get('/', asyncHandler(listPublicPosts));

blogRouter.get('/:slug', asyncHandler(getPublicPost));
blogRouter.get('/:slug/comments', asyncHandler(listPostComments));

/* I commenti richiedono un utente registrato: il nome autore viene dal
 * profilo e un utente puo' commentare una sola volta la stessa notizia. */
blogRouter.post(
    '/:slug/comments',
    asyncHandler(authMiddleware),
    asyncHandler(createComment)
);

/* ---------- gestione ---------- */

blogRouter.get(
    '/manage/posts',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(WRITER_ROLES)),
    asyncHandler(listManagePosts)
);

blogRouter.get(
    '/manage/posts/:postId',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(WRITER_ROLES)),
    asyncHandler(getManagePost)
);

blogRouter.post(
    '/manage/posts',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(WRITER_ROLES)),
    asyncHandler(createPost)
);

blogRouter.patch(
    '/manage/posts/:postId',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(WRITER_ROLES)),
    asyncHandler(updatePost)
);

blogRouter.delete(
    '/manage/posts/:postId',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(MANAGER_ROLES)),
    asyncHandler(deletePost)
);

blogRouter.get(
    '/manage/categories',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(WRITER_ROLES)),
    asyncHandler(listManageCategories)
);

blogRouter.post(
    '/manage/categories',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(MANAGER_ROLES)),
    asyncHandler(createCategory)
);

blogRouter.patch(
    '/manage/categories/:categoryId',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(MANAGER_ROLES)),
    asyncHandler(updateCategory)
);

blogRouter.delete(
    '/manage/categories/:categoryId',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(MANAGER_ROLES)),
    asyncHandler(deleteCategory)
);

blogRouter.get(
    '/manage/comments',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(MANAGER_ROLES)),
    asyncHandler(listManageComments)
);

blogRouter.patch(
    '/manage/comments/:commentId',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(MANAGER_ROLES)),
    asyncHandler(updateCommentStatus)
);

blogRouter.delete(
    '/manage/comments/:commentId',
    asyncHandler(authMiddleware),
    asyncHandler(hasRole(MANAGER_ROLES)),
    asyncHandler(deleteComment)
);
