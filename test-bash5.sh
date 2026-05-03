cat << 'EOF' > dummy_config.cjs
        let c = 'ext {';
         c = c.replace('ext {', "ext {\\n    androidxCoreVersion = '1.12.0'");
        console.log(c);
EOF
node dummy_config.cjs
