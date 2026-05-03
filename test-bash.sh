cat << 'EOF' > dummy_config.cjs
let c = "ext {\n    foo = 'bar'";
console.log(c);
EOF
node dummy_config.cjs
