const express = require('express');
const { PrismaClient } = require('@prisma/client');
const verifyToken = require('../middlewares/verifyToken');
const { checkProjectMembership } = require('../utils/projectPermissions');
const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/statistics/types/count:
 *   get:
 *     summary: Compter tous les types de tâches approuvés du projet
 *     tags: [Statistiques]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Nombre total de types de tâches approuvés
 */
router.get('/types/count', verifyToken, checkProjectMembership, async (req, res) => {
  const total = await prisma.taskType.count({
    where: {
      project_id: req.projectId,
      status: 'approved',
    },
  });
  res.json({ total });
});

/**
 * @swagger
 * /api/statistics/erreurs/count:
 *   get:
 *     summary: Compter toutes les erreurs approuvées du projet
 *     tags: [Statistiques]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Nombre total d’erreurs approuvées
 */
router.get('/erreurs/count', verifyToken, checkProjectMembership, async (req, res) => {
  const total = await prisma.error.count({
    where: {
      project_id: req.projectId,
      status: 'approved',
    },
  });
  res.json({ total });
});

/**
 * @swagger
 * /api/statistics/exercices/count:
 *   get:
 *     summary: Compter tous les exercices approuvés du projet
 *     tags: [Statistiques]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Nombre total d’exercices approuvés
 */
router.get('/exercices/count', verifyToken, checkProjectMembership, async (req, res) => {
  const total = await prisma.exercise.count({
    where: {
      project_id: req.projectId,
      status: 'approved',
    },
  });
  res.json({ total });
});

/**
 * @swagger
 * /api/statistics/composants/count:
 *   get:
 *     summary: Compter tous les composants de feedback approuvés du projet
 *     tags: [Statistiques]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Nombre total de composants approuvés
 */
router.get('/composants/count', verifyToken, checkProjectMembership, async (req, res) => {
  const total = await prisma.feedbackComponent.count({
    where: {
      project_id: req.projectId,
      status: 'approved',
    },
  });
  res.json({ total });
});

/**
 * @swagger
 * /api/statistics/feedbacks/count:
 *   get:
 *     summary: Compter tous les feedbacks approuvés du projet
 *     tags: [Statistiques]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Nombre total de feedbacks approuvés
 */
router.get('/feedbacks/count', verifyToken, checkProjectMembership, async (req, res) => {
  const total = await prisma.feedback.count({
    where: {
      project_id: req.projectId,
      status: 'approved',
    },
  });
  res.json({ total });
});

module.exports = router;
