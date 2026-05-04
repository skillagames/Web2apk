const c = `defaultConfig {
    applicationId safePackageName   // ❌ this is the problem
}`;
const finalPackageName = "com.myapp.yo";
console.log(c.replace(/\bapplicationId\s+[^\s]+/, 'applicationId "' + finalPackageName + '"'));

const c2 = `defaultConfig {
    applicationId "com.dummy.app"
}`;
console.log(c2.replace(/\bapplicationId\s+[^\s]+/, 'applicationId "' + finalPackageName + '"'));
