/**
 * Gateway key / management key auth for Knowledge v1 REST.
 */
import { getProject, getProjectInWorkspace } from "$lib/server/db";

export type ConnectV1AuthScope = {
  userId: string;
  projectId: string;
  workspaceId: string;
  authType: "gateway_key" | "management_key" | "session";
};

export type ConnectV1AuthFailure = {
  status: 401 | 403;
  error: string;
  message: string;
};

export async function authorizeKnowledgeWorkspaceRequest(args: {
  locals: App.Locals;
  workspaceId: string;
  projectId?: string;
}): Promise<ConnectV1AuthScope | ConnectV1AuthFailure> {
  const user = args.locals.user;
  if (!user) {
    return { status: 401, error: "unauthorized", message: "Gateway key or session required" };
  }

  const workspaceId = args.workspaceId.trim();
  if (!workspaceId) {
    return { status: 403, error: "invalid_workspace", message: "workspace_id is required" };
  }

  if (user.authType === "gateway_key") {
    const projectId = user.projectIdForKey;
    if (!projectId) {
      return { status: 401, error: "unauthorized", message: "Invalid gateway key scope" };
    }
    if (args.projectId && args.projectId !== projectId) {
      return {
        status: 403,
        error: "project_scope_mismatch",
        message: "project_id does not match the Gateway key project",
      };
    }
    const project = await getProject(projectId, user.uid);
    if (!project) {
      return { status: 403, error: "forbidden", message: "Project not found" };
    }
    const projectWorkspace = project.workspaceId ?? workspaceId;
    if (projectWorkspace !== workspaceId) {
      return {
        status: 403,
        error: "workspace_scope_mismatch",
        message: "workspace_id does not match the Gateway key project workspace",
      };
    }
    return {
      userId: user.uid,
      projectId,
      workspaceId: projectWorkspace,
      authType: "gateway_key",
    };
  }

  if (user.authType === "management_key" && user.workspaceId) {
    if (user.workspaceId !== workspaceId) {
      return {
        status: 403,
        error: "workspace_scope_mismatch",
        message: "workspace_id does not match the management key",
      };
    }
    if (!args.projectId) {
      return {
        status: 403,
        error: "project_id_required",
        message: "project_id is required for management key Knowledge requests",
      };
    }
    const project = await getProjectInWorkspace(args.projectId, user.workspaceId);
    if (!project) {
      return { status: 403, error: "forbidden", message: "Project not found in workspace" };
    }
    return {
      userId: project.userId,
      projectId: project.id,
      workspaceId: user.workspaceId,
      authType: "management_key",
    };
  }

  if (user.authType === "session" && user.uid) {
    const projectId = args.projectId;
    if (!projectId) {
      return {
        status: 403,
        error: "project_id_required",
        message: "project_id is required for session-authenticated Knowledge requests",
      };
    }
    const project = await getProject(projectId, user.uid);
    if (!project) {
      return { status: 403, error: "forbidden", message: "Project not found" };
    }
    const projectWorkspace = project.workspaceId ?? workspaceId;
    if (projectWorkspace !== workspaceId) {
      return {
        status: 403,
        error: "workspace_scope_mismatch",
        message: "workspace_id does not match project",
      };
    }
    return {
      userId: user.uid,
      projectId: project.id,
      workspaceId: projectWorkspace,
      authType: "session",
    };
  }

  return { status: 401, error: "unauthorized", message: "Unsupported auth type for Knowledge API" };
}
