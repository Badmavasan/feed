function formatTypePayload({ taskId, nom, parent = null, erreurs = [] }) {
  return {
    taskId,
    nom,
    parentType: parent
      ? {
          id: parent.id,
          taskId: parent.task_code,
          nom: parent.task_name
        }
      : null,
    erreurs: (erreurs || []).map((e) => ({
      id: e.id,
      tag: e.error_tag,
      description: e.description
    }))
  };
}



function formatErreurPayload({ tag, description, associatedTypes = [] }) {
  return {
    tag,
    description,
    associatedTypes: associatedTypes.map(t => ({
      id: t.id,
      taskId: t.task_code,
      nom: t.task_name
    }))
  };
}

function formatExercicePayload({ title, description, correct_codes, associatedTypes = [] }) {
  return {
    title,
    description,
    correct_codes,
    associatedTypes: associatedTypes.map(t => ({
      id: t.id,
      taskId: t.task_code,
      nom: t.task_name
    }))
  };
}


function formatComposantPayload({
  description,
  type,
  content,
  content_format,
  nature,
  error_id,
  status,
  tag,
  associatedExercises = [],
  associatedErrors = [],
  associatedTypes = []
}) {
  return {
    description,
    type,
    content,
    content_format,
    nature,
    error_id,
    status,
    tag,
    associatedExercises: associatedExercises.map(e => ({
      id: e.id,
      title: e.title
    })),
    associatedErrors: associatedErrors.map(e => ({
      id: e.id,
      tag: e.error_tag
    })),
    associatedTypes: associatedTypes.map(t => ({
      id: t.id,
      taskId: t.task_code,
      nom: t.task_name
    }))
  };
}

function formatFeedbackPayload({
  feedback_code,
  description,
  status,
  composants = [] // [{ id, position }]
}) {
  return {
    feedback_code,
    description,
    status,
    composants: composants.map(c => ({
      id: c.id,
      position: c.position
    }))
  };
}


module.exports = {
  formatTypePayload
};