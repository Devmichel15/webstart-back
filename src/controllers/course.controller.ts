import type { Request, Response } from 'express';
import { prisma } from '../db.js';

// List all courses (no filters for MVP)
export const getAllCourses = async (req: Request, res: Response) => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        teacher: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(courses);
  } catch (error) {
    console.error('Get courses error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a simple course
export const createCourse = async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;
    const teacherId = req.user?.userId;

    if (!title || !teacherId) {
      return res.status(400).json({ error: 'Title and Authentication are required' });
    }

    const course = await prisma.course.create({
      data: {
        title,
        description,
        teacherId,
      },
    });

    return res.status(201).json(course);
  } catch (error) {
    console.error('Create course error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get course with modules and lessons
export const getCourseDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const courseId = parseInt(id as string, 10);

    if (isNaN(courseId)) {
      return res.status(400).json({ error: 'ID de curso inválido' });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          include: {
            lessons: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ error: 'Curso não encontrado' });
    }

    // Transform lessons to follow the new videoId contract
    const transformedCourse = {
      ...course,
      modules: course.modules.map(module => ({
        ...module,
        lessons: module.lessons.map(lesson => transformLesson(lesson))
      }))
    };

    return res.json(transformedCourse);
  } catch (error: any) {
    console.error('--- ERRO DETALHADO EM getCourseDetails ---');
    console.error('Code:', error.code);
    console.error('Meta:', error.meta);
    console.error('Message:', error.message);
    
    return res.status(500).json({ 
      error: 'Erro interno ao buscar detalhes do curso',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create a Module
export const createModule = async (req: Request, res: Response) => {
  try {
    const { id: courseIdStr } = req.params;
    const { title, order } = req.body;
    const courseId = parseInt(courseIdStr as string);

    if (!title || isNaN(courseId)) {
      return res.status(400).json({ error: 'Title and valid Course ID are required' });
    }

    const module = await prisma.module.create({
      data: {
        title,
        order: order || 0,
        courseId,
      },
    });

    return res.status(201).json(module);
  } catch (error) {
    console.error('Create module error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper to extract YouTube Video ID
function extractYouTubeVideoId(url: string): string | null {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[7] && match[7].length === 11) {
    return match[7];
  }
  return null;
}

// Helper to transform lesson for return
function transformLesson(lesson: any) {
  const transformed = { ...lesson };
  
  // Backward compatibility: If no videoId but has videoUrl (YouTube), extract it
  if (!transformed.videoId && transformed.videoUrl) {
    const ytId = extractYouTubeVideoId(transformed.videoUrl);
    if (ytId) {
      transformed.videoId = ytId;
    }
  }

  // Always remove videoUrl from response
  delete transformed.videoUrl;
  return transformed;
}

// Create a Lesson
export const createLesson = async (req: Request, res: Response) => {
  try {
    const { moduleId: bodyModuleId, courseId, title, description, videoUrlInput, order } = req.body;
    const { id: paramModuleIdStr } = req.params;
    
    const moduleId = parseInt((bodyModuleId || paramModuleIdStr) as string);

    if (!title || isNaN(moduleId)) {
      return res.status(400).json({ error: 'Title and valid Module ID are required' });
    }

    let videoId: string | null = null;
    let videoUrl: string | null = null;

    if (videoUrlInput) {
      const ytId = extractYouTubeVideoId(videoUrlInput);
      
      if (ytId) {
        // Validation: Must be 11 chars (already checked in extractYouTubeVideoId, but enforcing here as per request)
        if (ytId.length !== 11) {
          return res.status(400).json({ error: 'Invalid YouTube Video ID length' });
        }
        videoId = ytId;
        videoUrl = null;
      } else if (videoUrlInput.includes('vimeo.com')) {
        videoId = null;
        videoUrl = videoUrlInput;
      } else {
        // Default to videoUrl if not YouTube/Vimeo? 
        // Request says: "Se for YouTube -> salve só o videoId", "Se for Vimeo -> salve videoId = null e videoUrl = original"
        videoUrl = videoUrlInput;
      }
    }

    const lesson = await prisma.lesson.create({
      data: {
        title,
        description,
        videoId,
        videoUrl,
        order: order || 0,
        moduleId,
      },
    });

    return res.status(201).json(transformLesson(lesson));
  } catch (error) {
    console.error('Create lesson error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Update a Lesson
export const updateLesson = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, videoUrlInput, order } = req.body;
    const lessonId = parseInt(id as string);

    if (isNaN(lessonId)) {
      return res.status(400).json({ error: 'Invalid Lesson ID' });
    }

    const existingLesson = await prisma.lesson.findUnique({
      where: { id: lessonId }
    });

    if (!existingLesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    let videoId = existingLesson.videoId;
    let videoUrl = existingLesson.videoUrl;

    if (videoUrlInput !== undefined) {
      if (videoUrlInput === null || videoUrlInput === '') {
        videoId = null;
        videoUrl = null;
      } else {
        const ytId = extractYouTubeVideoId(videoUrlInput);
        if (ytId) {
          if (ytId.length !== 11) {
            return res.status(400).json({ error: 'Invalid YouTube Video ID length' });
          }
          videoId = ytId;
          videoUrl = null;
        } else if (videoUrlInput.includes('vimeo.com')) {
          videoId = null;
          videoUrl = videoUrlInput;
        } else {
          videoId = null;
          videoUrl = videoUrlInput;
        }
      }
    }

    const updatedLesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        title: title !== undefined ? title : existingLesson.title,
        description: description !== undefined ? description : existingLesson.description,
        videoId,
        videoUrl,
        order: order !== undefined ? order : existingLesson.order,
      },
    });

    return res.json(transformLesson(updatedLesson));
  } catch (error) {
    console.error('Update lesson error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
