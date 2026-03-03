.PHONY: up down logs

up:
	docker compose -f ops/compose/docker-compose.yml up -d --build

down:
	docker compose -f ops/compose/docker-compose.yml down

logs:
	docker compose -f ops/compose/docker-compose.yml logs -f --tail=150
