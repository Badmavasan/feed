const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const verifyToken = require('../middlewares/verifyToken');

/**
 * @swagger
 * /api/moderations/{id}/messages:
 *   get:
 *     summary: Retrieve messages for a moderation request
 *     tags: [ModerationMessages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the moderation request
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of moderation messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   content:
 *                     type: string
 *                   sender:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                   isSystemMessage:
 *                     type: boolean
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       403:
 *         description: Forbidden - user does not have access
 *       404:
 *         description: Moderation request not found
 */
router.get('/:id/messages', verifyToken, async (req, res) => {
  const moderationId = parseInt(req.params.id);
  const userId = req.user.id;

  // Verify permissions (requester or editor of the project)
  const moderation = await prisma.moderationRequest.findUnique({
    where: { id: moderationId },
    include: {
      requester: true,
      project: {
        include: {
          memberships: true,
        }
      }
    }
  });

  if (!moderation) return res.status(404).json({ message: "Demande introuvable" });

  const isAllowed =
    moderation.requester_id === userId ||
    moderation.project.memberships.some(m => m.user_id === userId && m.role === 'editeur');

  if (!isAllowed) return res.status(403).json({ message: "Accès interdit" });

  const messages = await prisma.moderationMessage.findMany({
    where: { moderationId },
    include: {
    sender: {
      select: {
        id: true,
        name: true,
        email: true,
        avatar_url: true,
        role: true
      }
    }
  },
    orderBy: { createdAt: 'asc' }
  });

  res.json(messages);
});

/**
 * @swagger
 * /api/moderations/{id}/messages:
 *   post:
 *     summary: Send a message in a moderation request discussion
 *     tags: [ModerationMessages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the moderation request
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Message content
 *     responses:
 *       201:
 *         description: Message successfully created
 *       400:
 *         description: Content is required
 *       403:
 *         description: Forbidden - user does not have access
 *       404:
 *         description: Moderation request not found
 */
router.post('/:id/messages', verifyToken, async (req, res) => {
  const moderationId = parseInt(req.params.id);
  const { content } = req.body;
  const userId = req.user.id;

  if (!content) return res.status(400).json({ message: "Le contenu est requis" });

  const moderation = await prisma.moderationRequest.findUnique({
    where: { id: moderationId },
    include: {
      requester: true,
      project: {
        include: {
          memberships: true,
        }
      }
    }
  });

  if (!moderation) return res.status(404).json({ message: "Demande introuvable" });

  const isAllowed =
    moderation.requester_id === userId ||
    moderation.project.memberships.some(m => m.user_id === userId && m.role === 'editeur');

  if (!isAllowed) return res.status(403).json({ message: "Accès interdit" });

  const message = await prisma.moderationMessage.create({
    data: {
      content,
      senderId: userId,
      moderationId,
      isSystemMessage: false
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar_url: true,
          role: true
        }
      }
    }

  });

  res.status(201).json(message);
});


async function sendSystemMessage(moderationId, content) {
  const systemUser = await prisma.user.findUnique({
    where: { email: 'system@bot.com' }
  });

  if (!systemUser) throw new Error("System Bot not found");

  return prisma.moderationMessage.create({
    data: {
      content,
      senderId: systemUser.id,
      moderationId,
      isSystemMessage: true
    }
  });
}

module.exports = router;