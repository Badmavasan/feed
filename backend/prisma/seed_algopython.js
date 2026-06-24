/**
 * Seed the "Algopython" project (task types, errors, exercises, feedbacks)
 * into the feed database, owned by an admin account.
 *
 * Data is generated from the feedback-generation-skill sources into
 * algopython_seed.json (see prisma/algopython_seed.json).
 *
 * Usage (from backend/):  node prisma/seed_algopython.js
 * Idempotent: safe to re-run — entities are matched on their unique keys.
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, "algopython_seed.json"), "utf8")
);

async function main() {
  // ── Admin account (creator / approver) ──────────────────────────────────
  const admin = await prisma.user.findUnique({
    where: { email: data.admin_email },
  });
  if (!admin) {
    throw new Error(
      `Admin account ${data.admin_email} not found — run the base seed (prisma/seed.js) first.`
    );
  }

  // ── Project ─────────────────────────────────────────────────────────────
  let project = await prisma.project.findFirst({
    where: { name: data.project.name, creator_id: admin.id },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: data.project.name,
        description: data.project.description,
        creator_id: admin.id,
        memberships: {
          create: { user_id: admin.id, role: "editeur" },
        },
      },
    });
    console.log(`Created project "${project.name}" (id=${project.id})`);
  } else {
    console.log(`Project "${project.name}" already exists (id=${project.id})`);
  }
  const projectId = project.id;

  // ── Task types ──────────────────────────────────────────────────────────
  const taskTypeId = {}; // task_code -> id
  for (const t of data.task_types) {
    const row = await prisma.taskType.upsert({
      where: { project_id_task_code: { project_id: projectId, task_code: t.task_code } },
      update: { task_name: t.task_name, status: t.status },
      create: {
        project_id: projectId,
        task_code: t.task_code,
        task_name: t.task_name,
        status: t.status,
      },
    });
    taskTypeId[t.task_code] = row.id;
  }
  console.log(`Task types     : ${data.task_types.length}`);

  // ── Errors ──────────────────────────────────────────────────────────────
  const errorId = {}; // error_tag -> id
  for (const e of data.errors) {
    const row = await prisma.error.upsert({
      where: { project_id_error_tag: { project_id: projectId, error_tag: e.error_tag } },
      update: { description: e.description, status: e.status },
      create: {
        project_id: projectId,
        error_tag: e.error_tag,
        description: e.description,
        status: e.status,
      },
    });
    errorId[e.error_tag] = row.id;
  }
  console.log(`Errors         : ${data.errors.length}`);

  // ── Task type ⇄ Error associations ──────────────────────────────────────
  let assocCount = 0;
  for (const a of data.task_type_errors) {
    const ttId = taskTypeId[a.task_code];
    const eId = errorId[a.error_tag];
    if (!ttId || !eId) continue;
    await prisma.taskTypeErrorAssociation.upsert({
      where: { task_type_id_error_id: { task_type_id: ttId, error_id: eId } },
      update: {},
      create: { task_type_id: ttId, error_id: eId },
    });
    assocCount++;
  }
  console.log(`TaskType⇄Error : ${assocCount}`);

  // ── Exercises (no unique key → match on title within project) ────────────
  const exerciseId = {}; // ex_code -> id
  for (const ex of data.exercises) {
    let row = await prisma.exercise.findFirst({
      where: { project_id: projectId, title: ex.title },
    });
    if (!row) {
      row = await prisma.exercise.create({
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
    }
    exerciseId[ex.ex_code] = row.id;
    for (const tc of ex.task_codes) {
      const ttId = taskTypeId[tc];
      if (!ttId) continue;
      await prisma.taskTypeExerciseAssociation.upsert({
        where: { task_type_id_exercise_id: { task_type_id: ttId, exercise_id: row.id } },
        update: {},
        create: { task_type_id: ttId, exercise_id: row.id },
      });
    }
  }
  console.log(`Exercises      : ${data.exercises.length}`);

  // ── Feedbacks (+ component + mapping) ───────────────────────────────────
  for (const fb of data.feedbacks) {
    const c = fb.component;
    const component = await prisma.feedbackComponent.upsert({
      where: { project_id_tag: { project_id: projectId, tag: c.tag } },
      update: {
        description: c.description,
        type: c.type,
        content: c.content,
        content_format: c.content_format,
        nature: c.nature,
        error_id: c.error_tag ? errorId[c.error_tag] : null,
        status: "approved",
      },
      create: {
        project_id: projectId,
        tag: c.tag,
        description: c.description,
        type: c.type,
        content: c.content,
        content_format: c.content_format,
        nature: c.nature,
        error_id: c.error_tag ? errorId[c.error_tag] : null,
        status: "approved",
      },
    });

    // link component to its exercise when known
    if (fb.exercise_code && exerciseId[fb.exercise_code]) {
      await prisma.componentExercise.upsert({
        where: {
          component_id_exercise_id: {
            component_id: component.id,
            exercise_id: exerciseId[fb.exercise_code],
          },
        },
        update: {},
        create: {
          component_id: component.id,
          exercise_id: exerciseId[fb.exercise_code],
        },
      });
    }

    const feedback = await prisma.feedback.upsert({
      where: {
        project_id_feedback_code: { project_id: projectId, feedback_code: fb.feedback_code },
      },
      update: { description: fb.description, status: "approved" },
      create: {
        project_id: projectId,
        feedback_code: fb.feedback_code,
        description: fb.description,
        status: "approved",
      },
    });

    await prisma.feedbackComponentsMapping.upsert({
      where: {
        feedback_id_component_id: { feedback_id: feedback.id, component_id: component.id },
      },
      update: { position: 0 },
      create: { feedback_id: feedback.id, component_id: component.id, position: 0 },
    });
  }
  console.log(`Feedbacks      : ${data.feedbacks.length}`);

  console.log("\nAlgopython seed complete.");
}

main()
  .catch((e) => {
    console.error("Algopython seeding error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
