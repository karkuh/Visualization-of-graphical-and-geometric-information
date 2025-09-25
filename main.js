'use strict';

let gl;
let surface;
let shProgram;
let spaceball;
let canvasGlobal;
let zoom = -6;

function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function(vertices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        this.count = vertices.length / 3;
    }

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        let mode = document.querySelector('input[name="renderMode"]:checked').value;

        if (mode === "lines") {
            gl.drawArrays(gl.LINES, 0, this.count);
        } else if (mode === "triangles") {
            gl.drawArrays(gl.TRIANGLES, 0, this.count);
        }
    }
}

function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    this.iAttribVertex = -1;
    this.iColor = -1;
    this.iModelViewProjectionMatrix = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}


function resizeCanvasToDisplaySize(canvas) {
    const displayWidth  = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        return true;
    }
    return false;
}

function draw() {
    resizeCanvasToDisplaySize(canvasGlobal);

    gl.viewport(0, 0, canvasGlobal.width, canvasGlobal.height);

    gl.clearColor(0.02, 0.02, 0.02, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let aspect = canvasGlobal.width / canvasGlobal.height;
    let projection = m4.perspective(Math.PI / 6, aspect, 0.1, 100);

    let modelView = spaceball.getViewMatrix();
    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, zoom);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0);

    let modelViewProjection = m4.multiply(projection, matAccum1);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);

    const color = document.getElementById("colorPicker").value;
    const r = parseInt(color.slice(1,3),16)/255;
    const g = parseInt(color.slice(3,5),16)/255;
    const b = parseInt(color.slice(5,7),16)/255;
    gl.uniform4fv(shProgram.iColor, [r,g,b,1.0]);

    const mode = document.querySelector('input[name="renderMode"]:checked').value;
    surface.Draw(mode);
}


function CreateVirichSurfaceLines(a, b, c, d, tSteps, vSteps, tMax, vMax) {
    let verts = [];
    function f_of_v(v) {
        let s = Math.sin(v), co = Math.cos(v);
        return (a*b) / Math.sqrt(a*a*s*s + b*b*co*co);
    }
    

    let grid = new Array((tSteps + 1) * (vSteps + 1));
    for (let i = 0; i <= tSteps; i++) {
        let t = tMax *i/tSteps;
        for (let j = 0; j <= vSteps; j++) {
            let v = vMax * j / vSteps;
            let fv = f_of_v(v);
            let common = 0.5*(fv*(1+Math.cos(t)) + (d*d-c*c)*(1-Math.cos(t))/fv);
            let x = common * Math.cos(v);
            let y = common * Math.sin(v);
            let z = 0.5*(fv - (d*d-c*c)/fv) * Math.sin(t);
            grid[i*(vSteps+1)+j] = [x,y,z];
        }
    }

    for (let i = 0; i <= tSteps; i++) {
        for (let j = 0; j <= vSteps; j++) {
            let idx = i*(vSteps+1)+j;
            if (i < tSteps) {
                let p0 = grid[idx], p1 = grid[(i+1)*(vSteps+1)+j];
                verts.push(p0[0],p0[1],p0[2]);
                verts.push(p1[0],p1[1],p1[2]);
            }
            if (j < vSteps) {
                let p0 = grid[idx], p1 = grid[i*(vSteps+1)+(j+1)];
                verts.push(p0[0],p0[1],p0[2]);
                verts.push(p1[0],p1[1],p1[2]);
            }
        }
    }

    return verts;
}

function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iColor                     = gl.getUniformLocation(prog, "color");

    surface = new Model('Surface');

    let a = parseFloat(document.getElementById("paramA").value);
    let b = parseFloat(document.getElementById("paramB").value);
    let c = parseFloat(document.getElementById("paramC").value);
    let d = parseFloat(document.getElementById("paramD").value);
    let tSteps = parseInt(document.getElementById("paramT").value);
    let vSteps = parseInt(document.getElementById("paramV").value);


    let tRange = document.querySelector('input[name="tRange"]:checked').value;
    let vRange = document.querySelector('input[name="vRange"]:checked').value;

    let tMax = (tRange === "pi") ? Math.PI : 2*Math.PI;
    let vMax = (vRange === "pi") ? Math.PI : 2*Math.PI;

    let verts = CreateVirichSurfaceLines(a,b,c,d,tSteps,vSteps,tMax,vMax);
    surface.BufferData(verts);


    gl.enable(gl.DEPTH_TEST);
    gl.lineWidth(1.0);
}

function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if(!gl.getShaderParameter(vsh,gl.COMPILE_STATUS)) throw new Error("Error in vertex shader: "+gl.getShaderInfoLog(vsh));

    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh,fShader);
    gl.compileShader(fsh);
    if(!gl.getShaderParameter(fsh,gl.COMPILE_STATUS)) throw new Error("Error in fragment shader: "+gl.getShaderInfoLog(fsh));

    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog,fsh);
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS)) throw new Error("Link error in program: "+gl.getProgramInfoLog(prog));

    return prog;
}

function init() {
    canvasGlobal = document.getElementById("webglcanvas");
    gl = canvasGlobal.getContext("webgl");
    if(!gl){ alert("Browser does not support WebGL"); return; }

    initGL();

    spaceball = new TrackballRotator(canvasGlobal, draw, 0);
    canvasGlobal.addEventListener("wheel", function(event){
        event.preventDefault();
        zoom += event.deltaY*0.01;
        zoom = Math.min(-2, Math.max(-40, zoom));
        draw();
    });

    draw();
}

function updateSurface() {
    let a = parseFloat(document.getElementById("paramA").value);
    let b = parseFloat(document.getElementById("paramB").value);
    let c = parseFloat(document.getElementById("paramC").value);
    let d = parseFloat(document.getElementById("paramD").value);
    let tSteps = parseInt(document.getElementById("paramT").value);
    let vSteps = parseInt(document.getElementById("paramV").value);

    tSteps = Math.max(4, Math.min(200,tSteps));
    vSteps = Math.max(4, Math.min(400,vSteps));

    let tRange = document.querySelector('input[name="tRange"]:checked').value;
    let vRange = document.querySelector('input[name="vRange"]:checked').value;

    let tMax = (tRange === "pi") ? Math.PI : 2*Math.PI;
    let vMax = (vRange === "pi") ? Math.PI : 2*Math.PI;

    let verts = CreateVirichSurfaceLines(a,b,c,d,tSteps,vSteps,tMax,vMax);
    surface.BufferData(verts);
    draw();
}


function resetView() {
    spaceball = new TrackballRotator(canvasGlobal, draw, 0);
    draw();
}

