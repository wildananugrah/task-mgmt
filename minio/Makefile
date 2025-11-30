.PHONY: help list-buckets list-objects upload download delete info health backup up down

# Minio connection settings
MINIO_ALIAS = myminio
MINIO_ENDPOINT = http://localhost:9000
MINIO_ACCESS_KEY = minioadmin
MINIO_SECRET_KEY = minioadmin123
BUCKET_NAME = task-mgmt-uploads

# Docker command shortcuts
MC = docker run --rm --network host minio/mc:latest
MC_LOCAL = docker run --rm --network host -v $$(pwd):/data minio/mc:latest

help: ## Show this help message
	@echo "Minio Management Commands"
	@echo "========================="
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Examples:"
	@echo "  make list-buckets          # List all buckets"
	@echo "  make list-objects          # List all objects"
	@echo "  make upload FILE=test.txt  # Upload file"
	@echo "  make info                  # Show storage info"

up: ## Start Minio container
	docker compose up -d

down: ## Stop Minio container
	docker compose down

setup: ## Setup Minio client alias
	@echo "Setting up Minio client alias..."
	@$(MC) alias set $(MINIO_ALIAS) $(MINIO_ENDPOINT) $(MINIO_ACCESS_KEY) $(MINIO_SECRET_KEY)
	@echo "✅ Alias '$(MINIO_ALIAS)' configured"

list-buckets: ## List all buckets
	@echo "📦 Listing all buckets..."
	@$(MC) ls $(MINIO_ALIAS)/

list-objects: ## List all objects in the bucket
	@echo "📄 Listing objects in $(BUCKET_NAME)..."
	@$(MC) ls --recursive --human-readable $(MINIO_ALIAS)/$(BUCKET_NAME)/

list-attachments: ## List all attachments
	@echo "📎 Listing attachments..."
	@$(MC) ls --recursive --human-readable $(MINIO_ALIAS)/$(BUCKET_NAME)/attachments/

list-designs: ## List all designs
	@echo "🎨 Listing designs..."
	@$(MC) ls --recursive --human-readable $(MINIO_ALIAS)/$(BUCKET_NAME)/designs/

info: ## Show bucket information and statistics
	@echo "📊 Bucket Information"
	@echo "====================="
	@echo ""
	@echo "Bucket: $(BUCKET_NAME)"
	@echo "Size:"
	@$(MC) du --human-readable $(MINIO_ALIAS)/$(BUCKET_NAME)
	@echo ""
	@echo "Object count:"
	@$(MC) ls --recursive $(MINIO_ALIAS)/$(BUCKET_NAME) | wc -l | xargs echo

health: ## Check Minio health status
	@echo "🏥 Checking Minio health..."
	@echo ""
	@echo -n "Live: "
	@curl -s -o /dev/null -w "%{http_code}" http://localhost:9000/minio/health/live && echo " ✅" || echo " ❌"
	@echo -n "Ready: "
	@curl -s -o /dev/null -w "%{http_code}" http://localhost:9000/minio/health/ready && echo " ✅" || echo " ❌"

stats: ## Show detailed statistics
	@echo "📈 Storage Statistics"
	@echo "===================="
	@echo ""
	@echo "Overall:"
	@$(MC) du --human-readable $(MINIO_ALIAS)/$(BUCKET_NAME)

find-large: ## Find files larger than 10MB
	@echo "🔍 Finding files larger than 10MB..."
	@$(MC) find $(MINIO_ALIAS)/$(BUCKET_NAME) --larger 10MB

backup: ## Backup bucket to local directory
	@BACKUP_DIR=./backup/$$(date +%Y%m%d_%H%M%S); \
	echo "💾 Backing up to $$BACKUP_DIR..."; \
	mkdir -p $$BACKUP_DIR; \
	docker run --rm --network host -v $$(pwd)/$$BACKUP_DIR:/backup minio/mc:latest \
		mirror $(MINIO_ALIAS)/$(BUCKET_NAME)/ /backup/; \
	echo "✅ Backup completed: $$BACKUP_DIR"

console: ## Open Minio console in browser
	@echo "🌐 Opening Minio console..."
	@echo "URL: http://localhost:9001"
	@echo "Username: $(MINIO_ACCESS_KEY)"
	@echo "Password: $(MINIO_SECRET_KEY)"
	@which open > /dev/null && open http://localhost:9001 || echo "Please open http://localhost:9001 in your browser"

credentials: ## Show Minio credentials
	@echo "🔑 Minio Credentials"
	@echo "==================="
	@echo ""
	@echo "Endpoint:    $(MINIO_ENDPOINT)"
	@echo "Access Key:  $(MINIO_ACCESS_KEY)"
	@echo "Secret Key:  $(MINIO_SECRET_KEY)"
	@echo "Bucket:      $(BUCKET_NAME)"
	@echo "Region:      us-east-1"
	@echo ""
	@echo "Console URL: http://localhost:9001"

logs: ## Show Minio container logs
	@docker logs --tail 100 -f task-mgmt-minio

restart: ## Restart Minio container
	@echo "🔄 Restarting Minio..."
	@docker compose restart
	@echo "✅ Minio restarted"