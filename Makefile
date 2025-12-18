# Makefile for building WebAssembly heap implementations

CC = emcc
BASE_CFLAGS = -O2 -s WASM=1 \
	-s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","HEAPU32","HEAPU8","HEAP32","HEAPF32"]' \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s MODULARIZE=1 \
	-s ENVIRONMENT='web' \
	-s SINGLE_FILE=1 \
	-s TOTAL_MEMORY=134217728 \
	-s EXPORT_ES6=1 \
	-s WASM_BIGINT=0 \

HEAP1_CFLAGS = $(BASE_CFLAGS) \
	-s EXPORTED_FUNCTIONS='["_heap_init","_heap_malloc","_heap_free","_heap_reset","_get_heap_stats","_get_allocation_count","_get_allocation_info","_get_log_count","_get_log_entry","_clear_log","_get_heap_offset"]' \
	-s EXPORT_NAME='Heap1Module'

HEAP2_CFLAGS = $(BASE_CFLAGS) \
	-s EXPORTED_FUNCTIONS='["_heap_init","_heap_malloc","_heap_free","_heap_reset","_get_heap_stats","_get_block_count","_get_block_info","_get_log_count","_get_log_entry","_clear_log"]' \
	-s EXPORT_NAME='Heap2Module'

HEAP3_CFLAGS = $(BASE_CFLAGS) \
	-s EXPORTED_FUNCTIONS='["_heap_init","_heap_malloc","_heap_free","_heap_reset","_get_heap_stats","_get_block_count","_get_block_info","_get_log_count","_get_log_entry","_clear_log"]' \
	-s EXPORT_NAME='Heap3Module'\
	-s USE_PTHREADS=1\
	-pthread

HEAP4_CFLAGS = $(BASE_CFLAGS) \
	-s EXPORTED_FUNCTIONS='["_heap_init","_heap_malloc","_heap_free","_heap_reset","_get_heap_stats","_get_block_count","_get_block_info","_get_log_count","_get_log_entry","_clear_log"]' \
	-s EXPORT_NAME='Heap4Module'

HEAP5_CFLAGS = $(BASE_CFLAGS) \
	-s EXPORTED_FUNCTIONS='["_heap_init","_heap_malloc","_heap_malloc_flags","_heap_free","_heap_reset","_get_heap_stats","_get_region_stats","_get_block_count","_get_block_info","_get_log_count","_get_log_entry","_clear_log","_get_region_count","_get_region_name","_get_region_flags","_get_region_size"]' \
	-s EXPORT_NAME='Heap5Module'

SRCDIR = c
BUILDDIR = src/js

SOURCES = $(SRCDIR)/heap_1.c $(SRCDIR)/heap_2.c $(SRCDIR)/heap_3.c $(SRCDIR)/heap_4.c $(SRCDIR)/heap_5.c
TARGETS = $(BUILDDIR)/heap1.js $(BUILDDIR)/heap2.js $(BUILDDIR)/heap3.js $(BUILDDIR)/heap4.js $(BUILDDIR)/heap5.js

.PHONY: all clean setup install dev build test-wsl heap1 heap2 heap3 heap4 heap5

all: setup $(TARGETS)

setup:
	@mkdir -p $(BUILDDIR)

heap1: $(BUILDDIR)/heap1.js
heap2: $(BUILDDIR)/heap2.js
heap3: $(BUILDDIR)/heap3.js
heap4: $(BUILDDIR)/heap4.js
heap5: $(BUILDDIR)/heap5.js

# For physical memory mode
heap5-physical: HEAP5_CFLAGS += -DUSE_PHYSICAL_MEM=1 -Wl,-T,c/heap_regions.ld
heap5-physical: $(BUILDDIR)/heap5.js

$(BUILDDIR)/heap1.js: $(SRCDIR)/heap_1.c
	@echo "Building Heap 1 WebAssembly module..."
	$(CC) $(HEAP1_CFLAGS) -o $@ $^
	@echo "Heap 1 module built successfully!"

$(BUILDDIR)/heap2.js: $(SRCDIR)/heap_2.c
	@echo "Building Heap 2 WebAssembly module..."
	$(CC) $(HEAP2_CFLAGS) -o $@ $^
	@echo "Heap 2 module built successfully!"

$(BUILDDIR)/heap3.js: $(SRCDIR)/heap_3.c
	@echo "Building Heap 3 WebAssembly module..."
	$(CC) $(HEAP3_CFLAGS) -o $@ $^
	@echo "Heap 3 module built successfully!"

$(BUILDDIR)/heap4.js: $(SRCDIR)/heap_4.c
	@echo "Building Heap 4 WebAssembly module..."
	$(CC) $(HEAP4_CFLAGS) -o $@ $^
	@echo "Heap 4 module built successfully!"

$(BUILDDIR)/heap5.js: $(SRCDIR)/heap_5.c
	@echo "Building Heap 5 WebAssembly module..."
	$(CC) $(HEAP5_CFLAGS) -o $@ $^
	@echo "Heap 5 module built successfully!"

clean:
	rm -f $(BUILDDIR)/heap1.js
	rm -f $(BUILDDIR)/heap2.js
	rm -f $(BUILDDIR)/heap3.js
	rm -f $(BUILDDIR)/heap4.js
	rm -f $(BUILDDIR)/heap5.js
	rm -rf node_modules
	rm -rf build

install:
	@echo "Installing npm dependencies..."
	npm install

dev: all
	@echo "Starting development server..."
	npm start

build: all
	@echo "Creating production build..."
	npm run build

test-wsl: all
	@echo "Starting development server for WSL..."
	@echo "Access at http://localhost:3000"
	BROWSER=none npm start

.DEFAULT_GOAL := all