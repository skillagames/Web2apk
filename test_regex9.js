const c = "    applicationId safePackageName   // comment\n";
console.log(c.replace(/\bapplicationId\s*=?\s*[^\n\r]+/g, 'applicationId "com.foo"'));
