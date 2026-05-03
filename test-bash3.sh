cat << 'EOF' > dummy_config.cjs
         c = c.replace('ext {', "ext {\\n    androidxCoreVersion = '1.12.0'");
EOF
