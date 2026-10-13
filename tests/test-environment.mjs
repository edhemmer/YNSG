// Release builds may inherit production mode; React interaction tests need its test helpers.
// This preload changes only the test subprocess, never the application build or deployed runtime.
process.env.NODE_ENV = "test";
