# Article Cover Image Integration Guide

This document describes how to add cover image functionality to the Article model using the existing file upload system with MinIO.

## Overview

This guide shows how to integrate the existing file upload system to add cover images to articles. The approach creates a relationship between the Article and File models, allowing articles to have optional cover images stored in MinIO.

## Step-by-Step Implementation

### Step 1: Update Prisma Schema

Add a cover image relationship to the Article model in `prisma/schema.prisma`:

```prisma
model Article {
  id           String   @id @default(uuid())
  title        String
  content      String?
  slug         String   @unique
  published    Boolean  @default(false)
  authorId     String
  author       User     @relation(fields: [authorId], references: [id])

  // Add cover image relationship
  coverImageId String?
  coverImage   File?    @relation(fields: [coverImageId], references: [id], onDelete: SetNull)

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([coverImageId])
  @@map("articles")
}
```

Also update the File model to include the reverse relation:

```prisma
model File {
  // ... existing fields ...

  // Add relation to articles
  articles     Article[]

  // ... rest of the model ...
}
```

### Step 2: Run Database Migration

After updating the schema, create and run a new migration:

```bash
cd be-api-generic
bunx prisma migrate dev --name add-article-cover-image
```

### Step 3: Create Article Service

Create `src/services/article.service.ts` to handle article operations with cover images:

```typescript
import prisma from '../config/database';
import { fileStorageService } from './file-storage.service';
import logger from '../config/logger';

interface CreateArticleData {
  title: string;
  content?: string;
  slug: string;
  published?: boolean;
  authorId: string;
  coverImageId?: string;
}

interface UpdateArticleData {
  title?: string;
  content?: string;
  slug?: string;
  published?: boolean;
  coverImageId?: string | null;
}

export class ArticleService {
  /**
   * Create article with optional cover image
   */
  async createArticle(data: CreateArticleData) {
    try {
      // Verify cover image exists if provided
      if (data.coverImageId) {
        const coverImage = await prisma.file.findUnique({
          where: { id: data.coverImageId }
        });

        if (!coverImage) {
          throw new Error('Cover image not found');
        }

        // Optionally verify the file is an image
        if (!coverImage.mimeType.startsWith('image/')) {
          throw new Error('Cover image must be an image file');
        }
      }

      const article = await prisma.article.create({
        data,
        include: {
          author: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          },
          coverImage: true
        }
      });

      logger.info('Article created with cover image', {
        articleId: article.id,
        coverImageId: data.coverImageId
      });

      return article;
    } catch (error) {
      logger.error('Failed to create article:', error);
      throw error;
    }
  }

  /**
   * Update article including cover image
   */
  async updateArticle(articleId: string, data: UpdateArticleData) {
    try {
      // Verify new cover image if provided
      if (data.coverImageId) {
        const coverImage = await prisma.file.findUnique({
          where: { id: data.coverImageId }
        });

        if (!coverImage) {
          throw new Error('Cover image not found');
        }

        if (!coverImage.mimeType.startsWith('image/')) {
          throw new Error('Cover image must be an image file');
        }
      }

      const article = await prisma.article.update({
        where: { id: articleId },
        data,
        include: {
          author: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          },
          coverImage: true
        }
      });

      logger.info('Article updated', { articleId });
      return article;
    } catch (error) {
      logger.error('Failed to update article:', error);
      throw error;
    }
  }

  /**
   * Upload and set cover image for article
   */
  async uploadAndSetCoverImage(
    articleId: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    userId: string
  ) {
    try {
      // Verify article exists and user owns it
      const article = await prisma.article.findUnique({
        where: { id: articleId },
        include: { coverImage: true }
      });

      if (!article) {
        throw new Error('Article not found');
      }

      if (article.authorId !== userId) {
        throw new Error('Unauthorized to update this article');
      }

      // Upload new cover image
      const uploadedFile = await fileStorageService.uploadFile(
        fileBuffer,
        originalName,
        mimeType,
        {
          userId,
          folder: 'article-covers',
          isPublic: true, // Article covers are typically public
          metadata: {
            articleId,
            type: 'article-cover'
          }
        }
      );

      // Delete old cover image if exists
      if (article.coverImage) {
        await fileStorageService.deleteFile(article.coverImage.id, userId);
      }

      // Update article with new cover image
      const updatedArticle = await prisma.article.update({
        where: { id: articleId },
        data: { coverImageId: uploadedFile.id },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          },
          coverImage: true
        }
      });

      logger.info('Cover image uploaded for article', {
        articleId,
        fileId: uploadedFile.id
      });

      return updatedArticle;
    } catch (error) {
      logger.error('Failed to upload cover image:', error);
      throw error;
    }
  }

  /**
   * Remove cover image from article
   */
  async removeCoverImage(articleId: string, userId: string) {
    try {
      const article = await prisma.article.findUnique({
        where: { id: articleId },
        include: { coverImage: true }
      });

      if (!article) {
        throw new Error('Article not found');
      }

      if (article.authorId !== userId) {
        throw new Error('Unauthorized to update this article');
      }

      if (article.coverImage) {
        // Delete the file from storage
        await fileStorageService.deleteFile(article.coverImage.id, userId);
      }

      // Remove cover image reference from article
      const updatedArticle = await prisma.article.update({
        where: { id: articleId },
        data: { coverImageId: null },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          },
          coverImage: true
        }
      });

      logger.info('Cover image removed from article', { articleId });
      return updatedArticle;
    } catch (error) {
      logger.error('Failed to remove cover image:', error);
      throw error;
    }
  }

  /**
   * Get article with cover image
   */
  async getArticle(articleId: string) {
    try {
      const article = await prisma.article.findUnique({
        where: { id: articleId },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          },
          coverImage: true
        }
      });

      if (!article) {
        throw new Error('Article not found');
      }

      // Generate fresh URL for private cover image if needed
      if (article.coverImage && !article.coverImage.isPublic) {
        const { getPresignedUrl } = await import('../config/minio');
        article.coverImage.url = await getPresignedUrl(article.coverImage.key, 3600);
      }

      return article;
    } catch (error) {
      logger.error('Failed to get article:', error);
      throw error;
    }
  }

  /**
   * List articles with cover images
   */
  async listArticles(
    filters: {
      authorId?: string;
      published?: boolean;
    } = {},
    pagination: {
      limit?: number;
      offset?: number;
    } = {}
  ) {
    try {
      const { limit = 20, offset = 0 } = pagination;

      const [articles, total] = await Promise.all([
        prisma.article.findMany({
          where: filters,
          take: limit,
          skip: offset,
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            },
            coverImage: true
          }
        }),
        prisma.article.count({ where: filters })
      ]);

      // Generate fresh URLs for private cover images
      const { getPresignedUrl } = await import('../config/minio');
      const articlesWithUrls = await Promise.all(
        articles.map(async (article) => {
          if (article.coverImage && !article.coverImage.isPublic) {
            article.coverImage.url = await getPresignedUrl(article.coverImage.key, 3600);
          }
          return article;
        })
      );

      return {
        articles: articlesWithUrls,
        total,
        limit,
        offset
      };
    } catch (error) {
      logger.error('Failed to list articles:', error);
      throw error;
    }
  }
}

export const articleService = new ArticleService();
```

### Step 4: Create Article Router

Create `src/routes/articles.router.ts` with cover image endpoints:

```typescript
import { Router } from 'express';
import { articleService } from '../services/article.service';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { fileUpload } from '../middleware/file-upload';
import { validateRequest } from '../middleware/validate-request';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createArticleSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255),
    content: z.string().optional(),
    slug: z.string().min(1).max(255),
    published: z.boolean().optional().default(false),
    coverImageId: z.string().uuid().optional()
  })
});

const updateArticleSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    content: z.string().optional(),
    slug: z.string().min(1).max(255).optional(),
    published: z.boolean().optional(),
    coverImageId: z.string().uuid().nullable().optional()
  })
});

/**
 * @swagger
 * /api/articles:
 *   post:
 *     summary: Create a new article with optional cover image
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - slug
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               slug:
 *                 type: string
 *               published:
 *                 type: boolean
 *               coverImageId:
 *                 type: string
 *                 description: UUID of previously uploaded file
 */
router.post(
  '/',
  authenticateToken,
  validateRequest(createArticleSchema),
  async (req: AuthRequest, res) => {
    try {
      const article = await articleService.createArticle({
        ...req.body,
        authorId: req.user!.userId
      });
      res.status(201).json(article);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/articles/{id}:
 *   patch:
 *     summary: Update article including cover image
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/:id',
  authenticateToken,
  validateRequest(updateArticleSchema),
  async (req: AuthRequest, res) => {
    try {
      const article = await articleService.updateArticle(
        req.params.id,
        req.body
      );
      res.json(article);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/articles/{id}/cover-image:
 *   post:
 *     summary: Upload and set cover image for article
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 */
router.post(
  '/:id/cover-image',
  authenticateToken,
  fileUpload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const article = await articleService.uploadAndSetCoverImage(
        req.params.id,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        req.user!.userId
      );

      res.json(article);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/articles/{id}/cover-image:
 *   delete:
 *     summary: Remove cover image from article
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/:id/cover-image',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const article = await articleService.removeCoverImage(
        req.params.id,
        req.user!.userId
      );
      res.json(article);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/articles/{id}:
 *   get:
 *     summary: Get article with cover image
 *     tags: [Articles]
 */
router.get('/:id', async (req, res) => {
  try {
    const article = await articleService.getArticle(req.params.id);
    res.json(article);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/articles:
 *   get:
 *     summary: List articles with cover images
 *     tags: [Articles]
 */
router.get('/', async (req, res) => {
  try {
    const { authorId, published, limit = '20', offset = '0' } = req.query;

    const result = await articleService.listArticles(
      {
        ...(authorId && { authorId: String(authorId) }),
        ...(published !== undefined && { published: published === 'true' })
      },
      {
        limit: parseInt(String(limit)),
        offset: parseInt(String(offset))
      }
    );

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
```

### Step 5: Register Article Routes

Add the article routes to your main Express app in `src/index.ts` or `src/app.ts`:

```typescript
import articlesRouter from './routes/articles.router';

// Add this line with your other route registrations
app.use('/api/articles', articlesRouter);
```

## Usage Examples

### 1. Two-Step Process: Upload Image First, Then Create Article

```bash
# Step 1: Upload image file
curl -X POST \
  'http://localhost:3000/api/files/upload?folder=article-covers&isPublic=true' \
  -H 'Authorization: Bearer your-jwt-token' \
  -F 'file=@cover-image.jpg'

# Response:
# {
#   "id": "file-uuid-here",
#   "originalName": "cover-image.jpg",
#   "url": "http://localhost:9000/..."
# }

# Step 2: Create article with cover image ID
curl -X POST \
  'http://localhost:3000/api/articles' \
  -H 'Authorization: Bearer your-jwt-token' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "My Article",
    "content": "Article content here...",
    "slug": "my-article",
    "coverImageId": "file-uuid-here"
  }'
```

### 2. Direct Upload: Upload Cover Image to Existing Article

```bash
# Upload and set cover image directly
curl -X POST \
  'http://localhost:3000/api/articles/article-uuid/cover-image' \
  -H 'Authorization: Bearer your-jwt-token' \
  -F 'file=@new-cover.jpg'
```

### 3. Update Article's Cover Image

```bash
# Option A: Upload new file first, then update article
curl -X PATCH \
  'http://localhost:3000/api/articles/article-uuid' \
  -H 'Authorization: Bearer your-jwt-token' \
  -H 'Content-Type: application/json' \
  -d '{
    "coverImageId": "new-file-uuid"
  }'

# Option B: Remove cover image
curl -X DELETE \
  'http://localhost:3000/api/articles/article-uuid/cover-image' \
  -H 'Authorization: Bearer your-jwt-token'
```

## Frontend Integration Example (React)

```jsx
import React, { useState } from 'react';
import axios from 'axios';

function ArticleForm() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [slug, setSlug] = useState('');
  const [coverImage, setCoverImage] = useState(null);
  const [coverImageId, setCoverImageId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Upload cover image first
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCoverImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result);
    reader.readAsDataURL(file);

    // Upload to server
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(
        '/api/files/upload?folder=article-covers&isPublic=true',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      setCoverImageId(response.data.id);
    } catch (error) {
      console.error('Failed to upload cover image:', error);
    }
  };

  // Create article with cover image
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post(
        '/api/articles',
        {
          title,
          content,
          slug,
          coverImageId
        },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      console.log('Article created:', response.data);
    } catch (error) {
      console.error('Failed to create article:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Cover Image:</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
        />
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Cover preview"
            style={{ maxWidth: '300px' }}
          />
        )}
      </div>

      <div>
        <label>Title:</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div>
        <label>Slug:</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
        />
      </div>

      <div>
        <label>Content:</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      <button type="submit">Create Article</button>
    </form>
  );
}
```

## Best Practices

1. **Image Validation**: Always validate that uploaded files are actually images
2. **File Size Limits**: Set appropriate limits for cover images (e.g., 5MB)
3. **Image Optimization**: Consider resizing/compressing images before storage
4. **Cleanup**: Delete orphaned cover images when articles are deleted
5. **Caching**: Cache cover image URLs for better performance
6. **Security**: Verify user ownership before allowing cover image updates

## Alternative Approaches

### Approach 1: Direct Upload During Article Creation
Instead of two steps, accept the file directly in article creation:
- Use multipart/form-data for article creation
- Handle file upload and article creation in one transaction

### Approach 2: Multiple Images Support
Extend to support multiple images:
- Create a separate ArticleImage junction table
- Allow gallery of images per article

### Approach 3: Image Processing Pipeline
Add image processing:
- Generate thumbnails
- Create responsive image sizes
- Convert to WebP format

## Migration Rollback

If you need to rollback the cover image feature:

```bash
# Rollback the migration
bunx prisma migrate rollback

# Or manually remove the field
ALTER TABLE articles DROP COLUMN "coverImageId";
```

## Troubleshooting

### Common Issues

1. **Migration Fails**: Ensure no existing articles have invalid cover image references
2. **File Not Found**: Verify MinIO is running and accessible
3. **Permission Denied**: Check user ownership of articles
4. **Image Not Displaying**: Verify bucket policy for public access