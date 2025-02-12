

import { Router } from 'express';
import { likePost, getPostById, getLikesForPost, getPostByCategory, uploadNewPost, getPostRoutesByCategory } from '../controllers/postController.js';
import { uploadFormData } from '../middlewares/multer.js';

const router = Router();

// ? : get posts with limit query of default to 15
// router.get('/', getPosts);
router.get('/', getPostRoutesByCategory);

// router.get('/', getPostByCategory);
router.post('/', getPostByCategory);

// ? : create a new post
// router.post('/', uploadPostImages, insertPost);
// router.post('/', uploadFormData, insertPostMe);
// router.post('/uploads/', uploadFormData, insertPostMe);
router.post('/uploads/', uploadFormData, uploadNewPost);

// ? : Handler to toggle like on a post
router.post('/:post_id/likes/:user_id', likePost);

// ? Endpoint to get users who liked a post
router.post('/:post_id/likes', getLikesForPost)

// ? : Find Single Post By Post _id
router.post('/:post_id', getPostById)


export default router;
