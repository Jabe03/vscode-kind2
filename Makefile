SHELL := /usr/bin/env bash
.SHELLFLAGS := -euo pipefail -c

JAVA_API_VERSION := 0.7.0

JAVA_API_DIR := ../kind2-java-api
LANGUAGE_SERVER_DIR := ../kind2-language-server
KIND2_DIR := ../kind2
INTERPRETER_DIR := interpreter

LSP_DISTRIBUTION_DIR := $(LANGUAGE_SERVER_DIR)/build/install/kind2-language-server
VSCODE_LSP_DIR := ./kind2-language-server

JAVA_API_JAR := $(JAVA_API_DIR)/build/libs/kind2-java-api-$(JAVA_API_VERSION).jar
LSP_API_JAR := $(LANGUAGE_SERVER_DIR)/lib/kind2-java-api-$(JAVA_API_VERSION).jar

.PHONY: all api lsp k2 int vscode help

all: vscode k2 int

api:
	@echo "Building Java API version $(JAVA_API_VERSION)..."
	cd "$(JAVA_API_DIR)" && \
		rm -rf build/libs && \
		./gradlew build && \
		./gradlew publishToMavenLocal && \
		rm -f build/libs/*-javadoc.jar build/libs/*-sources.jar

	@if [ ! -f "$(JAVA_API_JAR)" ]; then \
		echo "Expected Java API JAR was not produced:" >&2; \
		echo "  $(JAVA_API_JAR)" >&2; \
		echo >&2; \
		echo "Available JARs:" >&2; \
		find "$(JAVA_API_DIR)/build/libs" \
			-maxdepth 1 \
			-type f \
			-name '*.jar' \
			-print >&2 || true; \
		exit 1; \
	fi

	mkdir -p "$(LANGUAGE_SERVER_DIR)/lib"
	mv "$(JAVA_API_JAR)" "$(LSP_API_JAR)"

	@echo "Java API JAR copied to:"
	@echo "  $(LSP_API_JAR)"

lsp: api
	@echo "Building language server..."
	cd "$(LANGUAGE_SERVER_DIR)" && \
		./gradlew clean build installDist

	@if [ ! -d "$(LSP_DISTRIBUTION_DIR)" ]; then \
		echo "Language server distribution was not produced:" >&2; \
		echo "  $(LSP_DISTRIBUTION_DIR)" >&2; \
		exit 1; \
	fi

	@echo "Language server distribution created:"
	@echo "  $(LSP_DISTRIBUTION_DIR)"

k2:
	@echo "Building Kind 2 executable..."
	$(MAKE) -C "$(KIND2_DIR)"
	cp "$(KIND2_DIR)/bin/kind2" ./

	@echo "Kind 2 executable copied to:"
	@echo "  ./kind2"

int:
	@echo "Building interpreter..."
	cd "$(INTERPRETER_DIR)" && \
		npm install && \
		npm run build

	rm -rf out/interpreter
	mkdir -p out
	cp -r "$(INTERPRETER_DIR)/dist/interpreter/browser" out/interpreter

	@echo "Interpreter copied to:"
	@echo "  ./out/interpreter"

vscode: lsp
	@echo "Copying language server distribution into the VS Code project..."

	@if [ ! -d "$(LSP_DISTRIBUTION_DIR)" ]; then \
		echo "Language server distribution does not exist:" >&2; \
		echo "  $(LSP_DISTRIBUTION_DIR)" >&2; \
		exit 1; \
	fi

	rm -rf "$(VSCODE_LSP_DIR)"
	cp -r "$(LSP_DISTRIBUTION_DIR)" "$(VSCODE_LSP_DIR)"
	chmod +x "$(VSCODE_LSP_DIR)/bin/kind2-language-server"

	@echo "Language server distribution copied to:"
	@echo "  $(VSCODE_LSP_DIR)"

help:
	@echo "Usage: make [target ...]"
	@echo
	@echo "Targets:"
	@echo "  all      Build and copy all project components"
	@echo "  api      Build and publish the Java API"
	@echo "  lsp      Build the Java API and language server distribution"
	@echo "  k2       Build and copy the Kind 2 executable"
	@echo "  int      Build and copy the interpreter"
	@echo "  vscode   Build and copy the complete LSP distribution"
	@echo "  help     Show this help message"
	@echo
	@echo "Examples:"
	@echo "  make"
	@echo "  make all"
	@echo "  make api"
	@echo "  make lsp"
	@echo "  make k2 int"
	@echo "  make vscode"