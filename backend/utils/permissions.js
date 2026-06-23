const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Determine whether a user has permission to operate a module in a project
 * @param {number} userId - User ID
 * @param {string} module - Module name, e.g. 'exercise' 'taskType'
 * @param {string} action - 'create' | 'update' | 'delete'
 * @param {number} projectId - Project ID
 */
async function hasPermission(userId, module, action, projectIdInput) {
  const projectId = parseInt(projectIdInput, 10);
  if (isNaN(projectId)) {
    console.warn(`[hasPermission] projectId Invalid parameter:${projectIdInput}`);
    return false;
  }

  // Check the user's role in the project
  const membership = await prisma.projectMembership.findUnique({
    where: {
      user_id_project_id: {
        user_id: userId,
        project_id: projectId, // Make sure this is an Int
      },
    },
  });

  if (!membership) {
    console.warn(`[hasPermission] User ${userId} Not part of the project ${projectId}`);
    return false;
  }

  if (membership.role === 'editeur') {
    return true;
  }

  const permission = await prisma.userPermission.findUnique({
    where: {
      user_id_project_id_module: {
        user_id: userId,
        project_id: projectId,
        module,
      },
    },
  });

  if (!permission) return false;

  switch (action) {
    case 'create': return permission.can_create;
    case 'update': return permission.can_update;
    case 'delete': return permission.can_delete;
    default: return false;
  }
}


module.exports = { hasPermission };
