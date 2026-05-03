const scriptInject = "\n<script type=\"module\">\n";
console.log(scriptInject === String.fromCharCode(10) + '<script type="module">' + String.fromCharCode(10));
