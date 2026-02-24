ALTER TABLE `projects` ADD COLUMN `github_repo_owner` text;--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `github_repo_name` text;--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `github_connected_by_user_id` text;--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `github_connected_at` integer;--> statement-breakpoint
UPDATE `projects`
SET
  `github_repo_owner` = (
    SELECT `repo_owner`
    FROM `github_connections`
    WHERE `github_connections`.`project_id` = `projects`.`id`
  ),
  `github_repo_name` = (
    SELECT `repo_name`
    FROM `github_connections`
    WHERE `github_connections`.`project_id` = `projects`.`id`
  ),
  `github_connected_by_user_id` = (
    SELECT `created_by_user_id`
    FROM `github_connections`
    WHERE `github_connections`.`project_id` = `projects`.`id`
  ),
  `github_connected_at` = (
    SELECT `created_at`
    FROM `github_connections`
    WHERE `github_connections`.`project_id` = `projects`.`id`
  )
WHERE `id` IN (SELECT `project_id` FROM `github_connections`);--> statement-breakpoint
DROP TABLE `github_connections`;
