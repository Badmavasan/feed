const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Verify if the user is a project member
 * @param {number} userId
 * @param {number} projectId
 * @returns {Promise<boolean>}
 */
async function verifyUserProjectMembership(userId, projectId) {
  const membership = await prisma.projectMembership.findFirst({
    where: { user_id: userId, project_id: projectId }
  });
  return !!membership;
}

/**
* Express middleware, verifying projectId and user permissions in the request
* Used with verifyToken to ensure that req.user exists
 */
async function checkProjectMembership(req, res, next) {
  const projectIdRaw =
    req.query?.projectId ??
    req.body?.projectId ??
    req.params?.projectId;

  const projectId = Number(projectIdRaw);

  if (!projectId || isNaN(projectId)) {
    return res.status(400).json({ message: 'Missing or invalid projectId' });
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized: missing user info' });
  }

  const isMember = await verifyUserProjectMembership(userId, projectId);
  if (!isMember && req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Access denied: not a member of this project' });
  }

  req.projectId = projectId;
  next();
}


module.exports = {
  verifyUserProjectMembership,
  checkProjectMembership
};
