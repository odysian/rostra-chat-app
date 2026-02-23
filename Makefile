BACKEND_DIR := backend
BACKEND_VENV_BIN := $(BACKEND_DIR)/venv/bin
FRONTEND_DIR := frontend
SKIP_DB_BOOTSTRAP ?= 0

.PHONY: backend-verify frontend-verify
backend-verify:
	@test -x "$(BACKEND_VENV_BIN)/ruff" || (echo "Missing backend venv tools. Expected $(BACKEND_VENV_BIN)/ruff"; exit 1)
	@echo "Running backend verification checks..."
	@cd $(BACKEND_DIR) && \
		venv/bin/ruff check . && \
		venv/bin/mypy . --ignore-missing-imports && \
		SKIP_DB_BOOTSTRAP=$(SKIP_DB_BOOTSTRAP) venv/bin/pytest -v && \
		venv/bin/bandit -r app/ -ll

frontend-verify:
	@test -f "$(FRONTEND_DIR)/package.json" || (echo "Missing $(FRONTEND_DIR)/package.json"; exit 1)
	@echo "Running frontend verification checks..."
	@cd $(FRONTEND_DIR) && \
		npx tsc --noEmit && \
		npx eslint src/ && \
		npm run build && \
		npm test
