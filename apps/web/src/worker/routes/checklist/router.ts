import { Hono } from "hono";
import type { AppRouteEnv } from "../types";
import { getChecklistById, getChecklists } from "./get";
import { createChecklist, createChecklistItem } from "./post";
import { updateChecklistById, updateChecklistItem } from "./put";
import { deleteChecklistById, deleteChecklistItem } from "./delete";

const checklistRoutes = new Hono<AppRouteEnv>();

checklistRoutes.get("/", getChecklists);
checklistRoutes.post("/", createChecklist);
checklistRoutes.get("/:cid", getChecklistById);
checklistRoutes.put("/:cid", updateChecklistById);
checklistRoutes.delete("/:cid", deleteChecklistById);
checklistRoutes.post("/:cid/items", createChecklistItem);
checklistRoutes.put("/:cid/items/:itemId", updateChecklistItem);
checklistRoutes.delete("/:cid/items/:itemId", deleteChecklistItem);

export default checklistRoutes;
