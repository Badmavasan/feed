/**
 * Seed the "Algopython" project into the feed database, owned by an admin account.
 *
 * Model (generated from the feedback-generation-skill normalized CSVs into
 * algopython_seed.json):
 *   - task types, errors, exercises (+ task-type⇄exercise links)
 *   - 123 feedbacks, each decomposed into its components (one FeedbackComponent
 *     per characteristic: erreur_pointée / logos / technique / exemple), then
 *     mapped to the feedback in order. Each feedback links to its task type,
 *     error (optional) and exercise (optional).
 *
 * Usage (from backend/):  node prisma/seed_algopython.js
 * Idempotent: it wipes the Algopython project's own data first, then re-inserts,
 * so the DB always exactly matches the seed file.
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, "algopython_seed.json"), "utf8")
);

async function main() {
  // ── Admin account (creator) ──────────────────────────────────────────────
  const admin = await prisma.user.findUnique({ where: { email: data.admin_email } });
  if (!admin) {
    throw new Error(
      `Admin account ${data.admin_email} not found — run the base seed (prisma/seed.js) first.`
    );
  }

  // ── Project ───────────────────────────────────────────────────────────────
  let project = await prisma.project.findFirst({
    where: { name: data.project.name, creator_id: admin.id },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: data.project.name,
        description: data.project.description,
        creator_id: admin.id,
        memberships: { create: { user_id: admin.id, role: "editeur" } },
      },
    });
    console.log(`Created project "${project.name}" (id=${project.id})`);
  } else {
    console.log(`Reusing project "${project.name}" (id=${project.id}) — resetting its data`);
  }
  const projectId = project.id;

  // ── Wipe existing project data (dependency order) ──────────────────────────
  await prisma.feedbackComponentsMapping.deleteMany({ where: { feedback: { project_id: projectId } } });
  await prisma.componentExercise.deleteMany({ where: { component: { project_id: projectId } } });
  await prisma.componentTaskType.deleteMany({ where: { component: { project_id: projectId } } });
  await prisma.taskTypeExerciseAssociation.deleteMany({ where: { taskType: { project_id: projectId } } });
  await prisma.taskTypeErrorAssociation.deleteMany({ where: { taskType: { project_id: projectId } } });
  await prisma.feedback.deleteMany({ where: { project_id: projectId } });
  await prisma.feedbackComponent.deleteMany({ where: { project_id: projectId } });
  await prisma.exercise.deleteMany({ where: { project_id: projectId } });
  await prisma.error.deleteMany({ where: { project_id: projectId } });
  await prisma.taskType.deleteMany({ where: { project_id: projectId } });

  // ── Task types ─────────────────────────────────────────────────────────────
  const taskTypeId = {};
  for (const t of data.task_types) {
    const row = await prisma.taskType.create({
      data: { project_id: projectId, task_code: t.task_code, task_name: t.task_name, status: t.status },
    });
    taskTypeId[t.task_code] = row.id;
  }
  console.log(`Task types      : ${data.task_types.length}`);

  // ── Errors ───────────────────────────────────────────────────────────────--
  const errorId = {};
  for (const e of data.errors) {
    const row = await prisma.error.create({
      data: { project_id: projectId, error_tag: e.error_tag, description: e.description, status: e.status },
    });
    errorId[e.error_tag] = row.id;
  }
  console.log(`Errors          : ${data.errors.length}`);

  // ── Task type ⇄ Error associations ─────────────────────────────────────────
  for (const a of data.task_type_errors) {
    if (!taskTypeId[a.task_code] || !errorId[a.error_tag]) continue;
    await prisma.taskTypeErrorAssociation.create({
      data: { task_type_id: taskTypeId[a.task_code], error_id: errorId[a.error_tag] },
    });
  }
  console.log(`TaskType⇄Error  : ${data.task_type_errors.length}`);

  // ── Exercises (+ task-type associations) ───────────────────────────────────
  const exerciseId = {};
  for (const ex of data.exercises) {
    const row = await prisma.exercise.create({
      data: {
        project_id: projectId,
        title: ex.title,
        description: ex.description,
        type: ex.type,
        correct_codes: ex.correct_codes,
        correct_texts: ex.correct_texts,
        status: "approved",
      },
    });
    exerciseId[ex.ex_code] = row.id;
    for (const tc of ex.task_codes) {
      if (!taskTypeId[tc]) continue;
      await prisma.taskTypeExerciseAssociation.create({
        data: { task_type_id: taskTypeId[tc], exercise_id: row.id },
      });
    }
  }
  console.log(`Exercises       : ${data.exercises.length}`);

  // ── Feedbacks → decomposed components → mappings ───────────────────────────
  let componentCount = 0;
  for (const fb of data.feedbacks) {
    const fbErrorId = fb.error_tag ? errorId[fb.error_tag] : null;
    const fbTaskTypeId = fb.task_code ? taskTypeId[fb.task_code] : null;
    const fbExerciseId = fb.exercise_code ? exerciseId[fb.exercise_code] : null;

    const feedback = await prisma.feedback.create({
      data: {
        project_id: projectId,
        feedback_code: fb.feedback_code,
        description: fb.description,
        status: fb.status,
      },
    });

    for (const c of fb.components) {
      const component = await prisma.feedbackComponent.create({
        data: {
          project_id: projectId,
          tag: c.tag,
          description: c.description,
          type: c.type,
          content: c.content,
          content_format: c.content_format,
          nature: c.nature,
          error_id: fbErrorId,            // tie component to the feedback's error
          status: "approved",
        },
      });
      componentCount++;

      // component ⇄ task type / exercise context
      if (fbTaskTypeId) {
        await prisma.componentTaskType.create({
          data: { component_id: component.id, task_type_id: fbTaskTypeId },
        });
      }
      if (fbExerciseId) {
        await prisma.componentExercise.create({
          data: { component_id: component.id, exercise_id: fbExerciseId },
        });
      }

      await prisma.feedbackComponentsMapping.create({
        data: { feedback_id: feedback.id, component_id: component.id, position: c.position },
      });
    }
  }
  console.log(`Feedbacks       : ${data.feedbacks.length}`);
  console.log(`Components      : ${componentCount}`);

  console.log("\nAlgopython seed complete.");
}

main()
  .catch((e) => {
    console.error("Algopython seeding error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
