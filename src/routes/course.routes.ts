import { Router } from 'express';
import { 
  getAllCourses, 
  createCourse, 
  getCourseDetails,
  createModule,
  createLesson,
  updateLesson
} from '../controllers/course.controller.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';
import { Role } from '@prisma/client';

const router = Router();

// Courses
router.get('/', protect, getAllCourses);
router.post('/', protect, restrictTo(Role.ADMIN), createCourse);
router.get('/:id', protect, getCourseDetails);

// Modules
router.post('/:id/modules', protect, restrictTo(Role.ADMIN), createModule);

// Lessons (using module ID)
// Note: Router is mounted on /courses, so this would be /courses/modules/:id/lessons 
// or we can just use a separate route structure if preferred. 
// For now, keeping it consistent with the user's request: /modules/:id/lessons
// I'll add a specific route for modules to handle lessons more cleanly.
router.post('/modules/:id/lessons', protect, restrictTo(Role.ADMIN), createLesson);
router.put('/lessons/:id', protect, restrictTo(Role.ADMIN), updateLesson);

export default router;
