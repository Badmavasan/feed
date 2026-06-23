const express = require("express");
const { PrismaClient, ExerciseType } = require("@prisma/client");
const verifyToken = require("../middlewares/verifyToken");
const { hasPermission } = require("../utils/permissions");
const { checkProjectMembership } = require("../utils/projectPermissions");
const multer = require('multer');
const xlsx = require('xlsx');
const upload = multer();
const router = express.Router();
const prisma = new PrismaClient();


/**
 * @swagger
 * /api/exercises:
 *   get:
 *     summary: Get paginated list of approved exercises
 *     tags: [Exercise]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Current page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of exercises per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Keyword to search in title or description
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *         required: true
 *         description: Project ID to filter exercises
 *     responses:
 *       200:
 *         description: List of exercises
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 exercises:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Exercise'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not a project member)
 */
router.get("/", verifyToken, checkProjectMembership, async (req, res) => {
  const { page = 1, limit = 10, search = "", projectId } = req.query;
  const where = {
    status: "approved",
    project_id: parseInt(projectId),
    OR: [
      { title: { contains: search } },
      { description: { contains: search } },
    ],
  };

  const total = await prisma.exercise.count({ where });
  const exercises = await prisma.exercise.findMany({
    where,
    skip: (page - 1) * limit,
    take: parseInt(limit),
    orderBy: { id: "asc" },
  });

  res.json({
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / limit),
    exercises,
  });
});

/**
 * @swagger
 * /api/exercises/selectable:
 *   get:
 *     summary: Get all approved exercises (no pagination)
 *     tags: [Exercise]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Keyword to search in title or description
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *         required: true
 *         description: Project ID to filter exercises
 *     responses:
 *       200:
 *         description: List of exercises
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Exercise'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not a project member)
 */
router.get("/selectable", verifyToken, checkProjectMembership, async (req, res) => {
  const { search = "", projectId } = req.query;
  const exercises = await prisma.exercise.findMany({
    where: {
      status: "approved",
      project_id: parseInt(projectId),
      OR: [
        { title: { contains: search } },
        { description: { contains: search } },
      ],
    },
  });
  res.json(exercises);
});



/**
 * @swagger
 * /api/exercises:
 *   post:
 *     summary: Create a new exercise (may require approval)
 *     tags: [Exercises]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, projectId, type]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               correctCodes: { type: array, items: { type: string } }
 *               taskTypes: { type: array, items: { type: integer } }
 *               choices: { type: array }
 *               type: { type: string, enum: ["CODE", "QCM", "MULTI_QCM"] }
 *               projectId: { type: integer }
 *     responses:
 *       200:
 *         description: Exercise created
 *       202:
 *         description: Submitted for moderation
 */
router.post("/", verifyToken, checkProjectMembership, async (req, res) => {
  const {
    title,
    description,
    correctCodes = [],
    correctTexts = [],
    taskTypes = [],
    projectId,
    type = "CODE",
    choices = [],
  } = req.body;
  const user = req.user;
  const parsedProjectId = parseInt(projectId);

  if (!title) {
    return res.status(400).json({ message: "Title is required." });
  }

  // type checking
  if (type === "CODE" && correctCodes.length === 0) {
    return res.status(400).json({ message: "Correct codes are required for CODE exercises." });
  }
  if ((type === "QCM" || type === "MULTI_QCM") && choices.length === 0) {
    return res.status(400).json({ message: "Choices are required for QCM exercises." });
  }
  const correctCount = choices.filter(c => c.isCorrect).length;
  if (type === "QCM" && correctCount !== 1) {
    return res.status(400).json({ message: "Exactly one correct choice is required for QCM." });
  }
  if (type === "MULTI_QCM" && correctCount < 2) {
    return res.status(400).json({ message: "At least two correct choices are required for MULTI_QCM." });
  }
  if (type === "FILL_IN_BLANK" && correctTexts.length === 0) {
    return res.status(400).json({ message: "Correct answers are required for FILL_IN_BLANK exercises." });
  }

  const canCreate = await hasPermission(user.id, "exercise", "create", parsedProjectId);

  if (canCreate) {
    const created = await prisma.exercise.create({
      data: {
        title,
        description,
        type,
        correct_codes: correctCodes,
        correct_texts: correctTexts,
        choices,
        status: "approved",
        project_id: parsedProjectId,
      },
    });

    if (taskTypes.length > 0) {
      await prisma.taskTypeExerciseAssociation.createMany({
        data: taskTypes.map(tid => ({
          exercise_id: created.id,
          task_type_id: tid,
        })),
      });
    }

    return res.json({ message: "Exercise created", exercise: created });
  } else {
    const details = await prisma.taskType.findMany({
      where: { id: { in: taskTypes } },
      select: { id: true, task_code: true, task_name: true },
    });

    const moderation = await prisma.moderationRequest.create({
      data: {
        requester_id: user.id,
        entity_type: "exercise",
        action_type: "create",
        status: "pending_review",
        payload: {
          title,
          description,
          correctCodes,
          correctTexts,
          taskTypes: details,
          type,
          choices,
          projectId: parsedProjectId,
        },
        project_id: parsedProjectId,
      },
    });

    return res.status(202).json({ message: "Submitted for moderation", moderation_id: moderation.id });
  }
});

/**
 * @swagger
 * /api/exercises/{id}:
 *   put:
 *     summary: Update an existing exercise (may require approval)
 *     tags: [Exercises]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, type]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               correctCodes: { type: array, items: { type: string } }
 *               taskTypes: { type: array, items: { type: integer } }
 *               choices: { type: array }
 *               type: { type: string }
 *     responses:
 *       200:
 *         description: Exercise updated
 *       202:
 *         description: Submitted for moderation
 */
router.put("/:id", verifyToken, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    title,
    description,
    correctCodes = [],
    correctTexts = [],
    taskTypes = [],
    type = "CODE",
    choices = [],
  } = req.body;
  const user = req.user;

  if (!title) {
    return res.status(400).json({ message: "Title is required." });
  }

  if (type === "CODE" && correctCodes.length === 0) {
    return res.status(400).json({ message: "Correct codes are required for CODE exercises." });
  }
  if ((type === "QCM" || type === "MULTI_QCM") && choices.length === 0) {
    return res.status(400).json({ message: "Choices are required for QCM exercises." });
  }
  const correctCount = choices.filter(c => c.isCorrect).length;
  if (type === "QCM" && correctCount !== 1) {
    return res.status(400).json({ message: "Exactly one correct choice is required for QCM." });
  }
  if (type === "MULTI_QCM" && correctCount < 2) {
    return res.status(400).json({ message: "At least two correct choices are required for MULTI_QCM." });
  }
  if (type === "FILL_IN_BLANK" && correctTexts.length === 0) {
    return res.status(400).json({ message: "Correct answers are required for FILL_IN_BLANK exercises." });
  }

  const projectId = (await prisma.exercise.findUnique({ where: { id } }))?.project_id;
  const canUpdate = await hasPermission(user.id, "exercise", "update", projectId);
  if (!canUpdate) {
    const details = await prisma.taskType.findMany({
      where: { id: { in: taskTypes } },
      select: { id: true, task_code: true, task_name: true },
    });

    await prisma.moderationRequest.create({
      data: {
        requester_id: user.id,
        entity_type: "exercise",
        entity_id: id,
        action_type: "update",
        status: "pending_review",
        payload: {
          title,
          description,
          correctCodes,
          correctTexts,
          taskTypes: details,
          type,
          choices,
        },
        project_id: projectId,
      },
    });

    return res.status(202).json({ message: "Submitted for moderation" });
  }

  await prisma.exercise.update({
    where: { id },
    data: {
      title,
      description,
      type,
      correct_codes: correctCodes,
      correct_texts: correctTexts,
      choices,
    },
  });

  await prisma.taskTypeExerciseAssociation.deleteMany({ where: { exercise_id: id } });
  if (taskTypes.length > 0) {
    await prisma.taskTypeExerciseAssociation.createMany({
      data: taskTypes.map(tid => ({ exercise_id: id, task_type_id: tid })),
    });
  }

  return res.json({ message: "Exercise updated" });
});


/**
 * @swagger
 * /api/exercises/{id}:
 *   delete:
 *     summary: Delete an exercise (may require approval)
 *     tags: [Exercises]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Exercise deleted
 *       202:
 *         description: Submitted for moderation
 */
router.delete("/:id", verifyToken, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);
  const user = req.user;

  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise) return res.status(404).json({ message: "Exercise not found" });

  const canDelete = await hasPermission(user.id, "exercise", "delete", exercise.project_id);
  if (!canDelete) {
    const types = await prisma.taskType.findMany({
      where: { exerciseAssociations: { some: { exercise_id: id } } },
      select: { id: true, task_code: true, task_name: true },
    });
    await prisma.moderationRequest.create({
      data: {
        requester_id: user.id,
        entity_type: "exercise",
        entity_id: id,
        action_type: "delete",
        status: "pending_review",
        payload: { ...exercise, taskTypes: types },
        project_id: exercise.project_id,
      },
    });
    return res.status(202).json({ message: "Submitted for moderation" });
  }

  await prisma.taskTypeExerciseAssociation.deleteMany({ where: { exercise_id: id } });
  await prisma.componentExercise.deleteMany({ where: { exercise_id: id } });
  await prisma.exercise.delete({ where: { id } });

  return res.json({ message: "Exercise deleted" });
});

/**
 * @swagger
 * /api/exercises/{id}:
 *   get:
 *     summary: Get detailed information about an approved exercise
 *     tags: [Exercise]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the exercise
 *     responses:
 *       200:
 *         description: Exercise detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 title:
 *                   type: string
 *                 description:
 *                   type: string
 *                 correctCodes:
 *                   type: array
 *                   items:
 *                     type: string
 *                 type:
 *                   type: string
 *                   enum: [CODE, QCM, MULTI_QCM, FILL_IN_BLANK]
 *                 choices:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       text:
 *                         type: string
 *                       isCorrect:
 *                         type: boolean
 *                 associatedTypes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       taskId:
 *                         type: string
 *                       name:
 *                         type: string
 *       404:
 *         description: Exercise not found or not approved
 */
router.get("/:id", verifyToken, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);
  const exercise = await prisma.exercise.findUnique({
    where: { id },
    include: {
      taskTypeAssociations: {
        include: { taskType: true }
      }
    }
  });

  if (!exercise || exercise.status !== "approved") {
    return res.status(404).json({ message: "Not found" });
  }

  const associatedTypes = exercise.taskTypeAssociations.map(assoc => ({
    id: assoc.taskType.id,
    taskId: assoc.taskType.task_code,
    name: assoc.taskType.task_name,
  }));

  res.json({
    id: exercise.id,
    title: exercise.title,
    description: exercise.description,
    correctCodes: exercise.correct_codes,
    correctTexts: exercise.correct_texts,
    type: exercise.type,
    choices: exercise.choices,
    associatedTypes,
  });
});

/**
 * @swagger
 * /api/exercises/{id}/associations:
 *   get:
 *     summary: Get task types associated with an exercise
 *     tags: [Exercise]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the exercise
 *     responses:
 *       200:
 *         description: List of associated task types
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   task_code:
 *                     type: string
 *                   task_name:
 *                     type: string
 *       401:
 *         description: Unauthorized
 */
router.get("/:id/associations", verifyToken, async (req, res) => {
  const id = parseInt(req.params.id);
  const types = await prisma.taskType.findMany({
    where: {
      exerciseAssociations: {
        some: { exercise_id: id }
      }
    },
    select: {
      id: true,
      task_code: true,
      task_name: true,
    },
  });
  res.json(types);
});


module.exports = router;
