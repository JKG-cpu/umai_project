CREATE TABLE `stores` (
	`id` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`locale` varchar(8) NOT NULL,
	CONSTRAINT `stores_id` PRIMARY KEY(`id`)
);

CREATE TABLE `token_votes` (
	`id` varchar(36) NOT NULL,
	`store_id` varchar(64) NOT NULL,
	`raw_token` varchar(128) NOT NULL,
	`label` varchar(128) NOT NULL,
	`vote_count` int NOT NULL DEFAULT 0,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `token_votes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_token_label` UNIQUE(`store_id`, `raw_token`, `label`)
);

CREATE TABLE `votes` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`store_id` varchar(64) NOT NULL,
	`raw_token` varchar(128) NOT NULL,
	`label` varchar(128) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `votes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_user_vote` UNIQUE(`user_id`, `store_id`, `raw_token`)
);

CREATE TABLE `token_locks` (
	`store_id` varchar(64) NOT NULL,
	`raw_token` varchar(128) NOT NULL,
	`label` varchar(128) NOT NULL,
	`locked_at` timestamp NOT NULL DEFAULT (now()),
	`total_votes` int NOT NULL,
	CONSTRAINT `token_locks_store_id_raw_token_pk` PRIMARY KEY(`store_id`, `raw_token`)
);
