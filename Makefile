SHELL := /bin/bash

.PHONY: help test build build-sample build-incremental pagefind serve clean

.DEFAULT_GOAL := help

NODE   ?= node
OUT    ?= dist
SERIES ?= AMADOR,MT._AIRY
PORT   ?= 8080

help: ## Show available targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

test: ## Run the full node:test suite
	npm test

build: ## Build the full static site into $(OUT)
	$(NODE) src/cli/build.js --out $(OUT)

build-incremental: ## Incrementally build changed series into $(OUT)
	$(NODE) src/cli/build.js --out $(OUT) --incremental

build-sample: ## Build a small sample subset ($(SERIES)) into $(OUT)
	$(NODE) src/cli/build.js --series $(SERIES) --out $(OUT)

pagefind: ## Index $(OUT) with Pagefind for full-text search
	npx --yes pagefind --site $(OUT)

serve: ## Serve $(OUT) locally on http://localhost:$(PORT)
	python3 -m http.server $(PORT) --directory $(OUT)

clean: ## Remove generated build output ($(OUT))
	rm -rf $(OUT)
