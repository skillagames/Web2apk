const r1 = /minSdkVersion\s/;
const r2 = /minSdkVersion\\s/;
console.log(r1.test("minSdkVersion "));
console.log(r2.test("minSdkVersion\\s"));
