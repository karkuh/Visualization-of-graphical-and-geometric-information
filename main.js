'use strict';

let gl;
let surface;
let shProgram;
let spaceball;
let canvasGlobal;
let zoom = -20;
let lightSphere;
let textures = {};

let projectionMatrix = m4.identity();
let modelMatrix = m4.identity();
let viewMatrix = m4.identity();
let normalMatrix4 = m4.identity();
let inverseViewMatrix = m4.identity();
let zoomMatrix = m4.identity();
let lightModelMatrix = m4.identity();

let lightPos = new Float32Array(3);
let viewPos_WorldSpace = new Float32Array(3);
let normalMatrix = new Float32Array(9); 
let lightNormalMatrix = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

let renderSettings = {
    lightMode: "static",
    renderMode: "lines",
    useDiffuse: true,
    useSpecular: true,
    useNormal: true
};



function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iUVBuffer = gl.createBuffer();
    this.iTangentBuffer = gl.createBuffer();
    this.iBitangentBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.iLineIndexBuffer = gl.createBuffer();
    this.count = 0;
    this.indexCount = 0;
    this.lineIndexCount = 0;

    this.BufferData = function(vertices, normals, uvs, tangents, bitangents, indices, lineIndices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        this.count = vertices.length / 3;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iUVBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tangents), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iBitangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bitangents), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
        this.indexCount = indices.length;

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iLineIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(lineIndices), gl.STATIC_DRAW);
        this.lineIndexCount = lineIndices.length;
    }

    this.Draw = function(mode) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        if (shProgram.iAttribUV >= 0) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.iUVBuffer);
            gl.vertexAttribPointer(shProgram.iAttribUV, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(shProgram.iAttribUV);
        }
        if (shProgram.iAttribTangent >= 0) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
            gl.vertexAttribPointer(shProgram.iAttribTangent, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(shProgram.iAttribTangent);
        }
        if (shProgram.iAttribBitangent >= 0) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.iBitangentBuffer);
            gl.vertexAttribPointer(shProgram.iAttribBitangent, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(shProgram.iAttribBitangent);
        }

        if (mode === "triangles") {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
            gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
        } else if (mode === "lines") {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iLineIndexBuffer);
            gl.drawElements(gl.LINES, this.lineIndexCount, gl.UNSIGNED_SHORT, 0);
        }
    }
}

function generateIndices(uSteps, vSteps) {
    let indices = [];
    for (let i = 0; i < uSteps; i++) {
        for (let j = 0; j < vSteps; j++) {
            let idx = i * (vSteps + 1) + j;
            let idxNextU = (i + 1) * (vSteps + 1) + j;
            let idxNextV = i * (vSteps + 1) + (j + 1);
            let idxDiag = (i + 1) * (vSteps + 1) + (j + 1);

            indices.push(idx, idxNextU, idxDiag);
            indices.push(idx, idxDiag, idxNextV);
        }
    }
    return indices;
}

function generateLineIndices(uSteps, vSteps) {
    let indices = [];
    for (let i = 0; i <= uSteps; i++) {
        for (let j = 0; j <= vSteps; j++) {
            let idx = i * (vSteps + 1) + j;
            
            if (j < vSteps) {
                let idxNextV = i * (vSteps + 1) + (j + 1);
                indices.push(idx, idxNextV);
            }
            if (i < uSteps) {
                let idxNextU = (i + 1) * (vSteps + 1) + j;
                indices.push(idx, idxNextU);
            }
        }
    }
    return indices;
}


function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    this.iAttribVertex = -1;
    this.iAttribNormal = -1;
    this.iAttribUV = -1;
    this.iAttribTangent = -1;
    this.iAttribBitangent = -1;

    this.iModelMatrix = -1;
    this.iViewMatrix = -1;
    this.iProjectionMatrix = -1;
    this.iNormalMatrix = -1;

    this.uLightPosition = -1;
    this.uViewPosition = -1;
    this.uAmbientColor = -1;
    this.uDiffuseColor = -1;
    this.uSpecularColor = -1;
    this.uShininess = -1;
    this.uIsLight = -1;

    this.uDiffuseMap = -1;
    this.uSpecularMap = -1;
    this.uNormalMap = -1;

    this.uUseDiffuseMap = -1;
    this.uUseSpecularMap = -1;
    this.uUseNormalMap = -1;

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
function inverse3(m) {
    const a00 = m[0], a01 = m[1], a02 = m[2];
    const a10 = m[3], a11 = m[4], a12 = m[5];
    const a20 = m[6], a21 = m[7], a22 = m[8];
    const det = a00*(a11*a22 - a12*a21) - a01*(a10*a22 - a12*a20) + a02*(a10*a21 - a11*a20);
    if (det === 0) return null;
    const invDet = 1.0 / det;
    const inv = [
        (a11*a22 - a12*a21) * invDet, (a02*a21 - a01*a22) * invDet, (a01*a12 - a02*a11) * invDet,
        (a12*a20 - a10*a22) * invDet, (a00*a22 - a02*a20) * invDet, (a02*a10 - a00*a12) * invDet,
        (a10*a21 - a11*a20) * invDet, (a01*a20 - a00*a21) * invDet, (a00*a11 - a01*a10) * invDet
    ];
    return [ inv[0], inv[3], inv[6], inv[1], inv[4], inv[7], inv[2], inv[5], inv[8] ];
}
function transpose3(m) { 
    return [ m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8] ];
}


function draw() {
    const resized = resizeCanvasToDisplaySize(canvasGlobal);
    if (resized) {
        gl.viewport(0, 0, canvasGlobal.width, canvasGlobal.height);
        projectionMatrix = m4.perspective(Math.PI / 6, canvasGlobal.width / canvasGlobal.height, 0.1, 100);
    }

    gl.clearColor(0.02, 0.02, 0.02, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


    let t = performance.now() * 0.001;
    let lightRadius = 10;
    lightPos[0] = lightRadius * Math.cos(t);
    lightPos[1] = 5;
    lightPos[2] = lightRadius * Math.sin(t);
    const lightModeValue = document.querySelector('input[name="lightMode"]:checked').value;
    const renderModeValue = document.querySelector('input[name="renderMode"]:checked').value;
    const isLightStatic = (lightModeValue === "static");

    if (isLightStatic) {
        viewMatrix = m4.translation(0, 0, zoom);
        modelMatrix = spaceball.getViewMatrix();
        normalMatrix4 = modelMatrix;

        normalMatrix[0] = normalMatrix4[0]; normalMatrix[1] = normalMatrix4[1]; normalMatrix[2] = normalMatrix4[2];
        normalMatrix[3] = normalMatrix4[4]; normalMatrix[4] = normalMatrix4[5]; normalMatrix[5] = normalMatrix4[6];
        normalMatrix[6] = normalMatrix4[8]; normalMatrix[7] = normalMatrix4[9]; normalMatrix[8] = normalMatrix4[10];

        viewPos_WorldSpace[0] = 0; viewPos_WorldSpace[1] = 0; viewPos_WorldSpace[2] = -zoom;

    } else {
        zoomMatrix = m4.translation(0, 0, zoom);
        viewMatrix = m4.multiply(zoomMatrix, spaceball.getViewMatrix());
        modelMatrix = m4.identity();

        normalMatrix[0] = 1; normalMatrix[1] = 0; normalMatrix[2] = 0;
        normalMatrix[3] = 0; normalMatrix[4] = 1; normalMatrix[5] = 0;
        normalMatrix[6] = 0; normalMatrix[7] = 0; normalMatrix[8] = 1;

        inverseViewMatrix = m4.inverse(viewMatrix);
        viewPos_WorldSpace[0] = inverseViewMatrix[12];
        viewPos_WorldSpace[1] = inverseViewMatrix[13];
        viewPos_WorldSpace[2] = inverseViewMatrix[14];
    }

    shProgram.Use();


    gl.uniform1i(shProgram.uUseDiffuseMap, renderSettings.useDiffuse);
    gl.uniform1i(shProgram.uUseSpecularMap, renderSettings.useSpecular);
    gl.uniform1i(shProgram.uUseNormalMap, renderSettings.useNormal);

    if (textures.diffuse) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures.diffuse);
        gl.uniform1i(shProgram.uDiffuseMap, 0);
    }
    if (textures.specular) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, textures.specular);
        gl.uniform1i(shProgram.uSpecularMap, 1);
    }
     if (textures.normal) {
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, textures.normal);
        gl.uniform1i(shProgram.uNormalMap, 2);
    }

    gl.uniformMatrix4fv(shProgram.iModelMatrix, false, modelMatrix);
    gl.uniformMatrix4fv(shProgram.iViewMatrix, false, viewMatrix);
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projectionMatrix);
    gl.uniformMatrix3fv(shProgram.iNormalMatrix, false, normalMatrix);

    gl.uniform3fv(shProgram.uLightPosition, lightPos);
    gl.uniform3fv(shProgram.uViewPosition, viewPos_WorldSpace);

    gl.uniform3fv(shProgram.uAmbientColor, [0.1, 0.1, 0.1]);
    gl.uniform3fv(shProgram.uDiffuseColor, [1.0, 1.0, 1.0]); 
    gl.uniform3fv(shProgram.uSpecularColor, [1.0, 1.0, 1.0]); 
    gl.uniform1f(shProgram.uShininess, 32.0);

    gl.uniform1i(shProgram.uIsLight, 0);
    surface.Draw(renderSettings.renderMode);

    
    lightModelMatrix = m4.translation(lightPos[0], lightPos[1], lightPos[2]);
    gl.uniformMatrix4fv(shProgram.iModelMatrix, false, lightModelMatrix);
    gl.uniformMatrix3fv(shProgram.iNormalMatrix, false, lightNormalMatrix);

    gl.uniform1i(shProgram.uIsLight, 1);
    lightSphere.Draw(renderSettings.renderMode);

    requestAnimationFrame(draw);
}


function computeSurfacePoint(a, b, c, d, u, v) {
    function f(v) {
        let s = Math.sin(v), co = Math.cos(v);
        return (a*b) / Math.sqrt(a*a*s*s + b*b*co*co);
    }
    let fv = f(v);
    let common = 0.5*(fv*(1+Math.cos(u)) + (d*d-c*c)*(1-Math.cos(u))/fv);
    let x = common * Math.cos(v);
    let y = common * Math.sin(v);
    let z = 0.5*(fv - (d*d-c*c)/fv) * Math.sin(u);
    let position = [x, y, z];

    function df(v) {
        let s = Math.sin(v), c0 = Math.cos(v);
        let numerator = - (a*a - b*b)*s*c0 * (a*b);
        let denom = Math.pow(a*a*s*s + b*b*c0*c0, 1.5);
        return numerator / denom;
    }
    let dfv = df(v);

    let dCommon_du = -0.5*Math.sin(u)*(fv - (d*d - c*c)/fv);
    let dx_du = dCommon_du*Math.cos(v);
    let dy_du = dCommon_du*Math.sin(v);
    let dz_du = 0.5*(fv - (d*d - c*c)/fv)*Math.cos(u);
    let Pu = [dx_du, dy_du, dz_du]; 

    let dCommon_dv = 0.5*(dfv*(1+Math.cos(u)) - (d*d - c*c)*dfv*(1 - Math.cos(u))/ (fv*fv));
    let dx_dv = dCommon_dv*Math.cos(v) - Math.sin(v)*(0.5*(fv*(1+Math.cos(u)) + (d*d - c*c)*(1 - Math.cos(u))/fv));
    let dy_dv = dCommon_dv*Math.sin(v) + Math.cos(v)*(0.5*(fv*(1+Math.cos(u)) + (d*d - c*c)*(1 - Math.cos(u))/fv));
    let dz_dv = 0.5*(dfv - (-(d*d - c*c)*dfv)/(fv*fv))*Math.sin(u);
    let Pv = [dx_dv, dy_dv, dz_dv]; 

    let N_raw = m4.cross(Pu, Pv);
    let N = m4.normalize(m4.scaleVector(N_raw, -1)); 

    let T = m4.normalize(Pu);
    
    let T_ortho = m4.normalize(m4.subtractVectors(T, m4.scaleVector(N, m4.dot(T, N))));

    let B_ortho = m4.normalize(m4.cross(N, T_ortho));

    return {
        position: position,
        normal: N,
        tangent: T_ortho,
        bitangent: B_ortho
    };
}

function CreateVirichSurfaceData(a, b, c, d, uSteps, vSteps, uMax, vMax) {
    let verts = [];
    let normals = [];
    let uvs = [];
    let tangents = [];
    let bitangents = [];

    for (let i = 0; i <= uSteps; i++) {
        let u = uMax * i / uSteps;
        for (let j = 0; j <= vSteps; j++) {
            let v = vMax * j / vSteps;

            let data = computeSurfacePoint(a, b, c, d, u, v);

            verts.push(...data.position);
            normals.push(...data.normal);
            tangents.push(...data.tangent);
            bitangents.push(...data.bitangent);
            
            uvs.push(j / vSteps, i / uSteps);
        }
    }

    return { verts: verts, normals: normals, uvs: uvs, tangents: tangents, bitangents: bitangents };
}


function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    shProgram = new ShaderProgram('Phong', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribNormal = gl.getAttribLocation(prog, "normal");
    shProgram.iAttribUV = gl.getAttribLocation(prog, "uv");
    shProgram.iAttribTangent = gl.getAttribLocation(prog, "tangent");
    shProgram.iAttribBitangent = gl.getAttribLocation(prog, "bitangent");

    shProgram.iModelMatrix = gl.getUniformLocation(prog, "ModelMatrix");
    shProgram.iViewMatrix = gl.getUniformLocation(prog, "ViewMatrix");
    shProgram.iProjectionMatrix = gl.getUniformLocation(prog, "ProjectionMatrix");
    shProgram.iNormalMatrix = gl.getUniformLocation(prog, "NormalMatrix");

    shProgram.uLightPosition = gl.getUniformLocation(prog, "uLightPosition");
    shProgram.uViewPosition = gl.getUniformLocation(prog, "uViewPosition");
    shProgram.uAmbientColor = gl.getUniformLocation(prog, "uAmbientColor");
    shProgram.uDiffuseColor = gl.getUniformLocation(prog, "uDiffuseColor");
    shProgram.uSpecularColor = gl.getUniformLocation(prog, "uSpecularColor");
    shProgram.uShininess = gl.getUniformLocation(prog, "uShininess");
    shProgram.uIsLight = gl.getUniformLocation(prog, "uIsLight");

    shProgram.uDiffuseMap = gl.getUniformLocation(prog, "uDiffuseMap");
    shProgram.uSpecularMap = gl.getUniformLocation(prog, "uSpecularMap");
    shProgram.uNormalMap = gl.getUniformLocation(prog, "uNormalMap");

    shProgram.uUseDiffuseMap = gl.getUniformLocation(prog, "uUseDiffuseMap");
    shProgram.uUseSpecularMap = gl.getUniformLocation(prog, "uUseSpecularMap");
    shProgram.uUseNormalMap = gl.getUniformLocation(prog, "uUseNormalMap");

    surface = new Model('Surface');

    let a = parseFloat(document.getElementById("paramA").value);
    let b = parseFloat(document.getElementById("paramB").value);
    let c = parseFloat(document.getElementById("paramC").value);
    let d = parseFloat(document.getElementById("paramD").value);
    let uSteps = parseInt(document.getElementById("paramU").value);
    let vSteps = parseInt(document.getElementById("paramV").value);

    let data = CreateVirichSurfaceData(a, b, c, d, uSteps, vSteps, 2 * Math.PI, 2 * Math.PI);
    let indices = generateIndices(uSteps, vSteps);
    let lineIndices = generateLineIndices(uSteps, vSteps);
    surface.BufferData(data.verts, data.normals, data.uvs, data.tangents, data.bitangents, indices, lineIndices);

    lightSphere = new Model('LightSphere');
    let sphereData = createSphere(0.2, 20, 10);
    let sphereIndices = sphereData.indices;
    let sphereLineIndices = generateLineIndices(20, 10);
    lightSphere.BufferData(sphereData.verts, sphereData.normals, sphereData.uvs, sphereData.tangents, sphereData.bitangents, sphereIndices, sphereLineIndices);

    gl.enable(gl.DEPTH_TEST);
    gl.lineWidth(1.0);

    resizeCanvasToDisplaySize(canvasGlobal);
    gl.viewport(0, 0, canvasGlobal.width, canvasGlobal.height);
    projectionMatrix = m4.perspective(Math.PI / 6, canvasGlobal.width / canvasGlobal.height, 0.1, 100);
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

function createSphere(radius, lats, longs) {
    let vertices = [];
    let normals = [];
    let uvs = [];
    let tangents = [];
    let bitangents = [];
    let indices = [];

    for (let i = 0; i <= lats; i++) {
        let lat = Math.PI * (-0.5 + i / lats);
        let sinLat = Math.sin(lat);
        let cosLat = Math.cos(lat);

        for (let j = 0; j <= longs; j++) {
            let lon = 2 * Math.PI * j / longs;
            let sinLon = Math.sin(lon);
            let cosLon = Math.cos(lon);

            let x = cosLon * cosLat;
            let y = sinLon * cosLat;
            let z = sinLat;
            
            let nx = x;
            let ny = y;
            let nz = z;
            let normal = [nx, ny, nz];

            let tx = -sinLon;
            let ty = cosLon;
            let tz = 0;
            let tangent = m4.normalize([tx, ty, tz]); 

            let bitangent = m4.normalize(m4.cross(tangent, normal)); 

            vertices.push(x * radius, y * radius, z * radius);
            normals.push(nx, ny, nz);
            uvs.push(j / longs, i / lats);
            tangents.push(tangent[0], tangent[1], tangent[2]);
            bitangents.push(bitangent[0], bitangent[1], bitangent[2]);
        }
    }

    for (let i = 0; i < lats; i++) {
        for (let j = 0; j < longs; j++) {
            let first = (i * (longs + 1)) + j;
            let second = first + longs + 1;

            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }

    return { 
        verts: vertices, 
        normals: normals, 
        uvs: uvs, 
        tangents: tangents, 
        bitangents: bitangents, 
        indices: indices 
    };
}

function loadTexture(gl, url) {
    return new Promise((resolve, reject) => {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
            new Uint8Array([128, 128, 128, 255]));

        const image = new Image();
        image.crossOrigin = "anonymous";
        
        image.onload = function() {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            
            if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
               gl.generateMipmap(gl.TEXTURE_2D);
               gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            } else {
               gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
               gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
               gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            }
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            
            console.log(`Texture loaded: ${url}`);
            resolve(texture);
        };
        
        image.onerror = function() {
            console.error(`Failed to load texture: ${url}`);
            reject(new Error(`Failed to load texture: ${url}`));
        }
        
        image.src = url;
    });
}

function isPowerOf2(value) {
    return (value & (value - 1)) == 0;
}

async function initApp() {
    try {
        canvasGlobal = document.getElementById("webglcanvas");
        gl = canvasGlobal.getContext("webgl");
        if (!gl) { alert("Browser does not support WebGL"); return; }

        console.log("Loading textures...");
        textures.diffuse = await loadTexture(gl, './textures/Stone_Floor_002_DIFFUSE.jpg').catch(e => null);
        textures.specular = await loadTexture(gl, './textures/Stone_Floor_002_SPEC.jpg').catch(e => null);
        textures.normal = await loadTexture(gl, './textures/Stone_Floor_002_NORM.jpg').catch(e => null);
        console.log("All textures loaded.");

        initGL(); 

        updateRenderSettings();
        spaceball = new TrackballRotator(canvasGlobal, draw, 0);
        canvasGlobal.addEventListener("wheel", function(event) {
            event.preventDefault();
            zoom += event.deltaY * 0.01;
            zoom = Math.min(-2, Math.max(-400, zoom));
        });

        draw(); 

    } catch (error) {
        console.error("Initialization failed:", error);
        alert("Failed to initialize WebGL or load textures. Check console.");
    }
}

function init() {
    initApp();
}

function updateSurface() {
    let a = parseFloat(document.getElementById("paramA").value);
    let b = parseFloat(document.getElementById("paramB").value);
    let c = parseFloat(document.getElementById("paramC").value);
    let d = parseFloat(document.getElementById("paramD").value);
    let uSteps = parseInt(document.getElementById("paramU").value);
    let vSteps = parseInt(document.getElementById("paramV").value);

    uSteps = Math.max(4, Math.min(200, uSteps));
    vSteps = Math.max(4, Math.min(400, vSteps));

    let data = CreateVirichSurfaceData(a, b, c, d, uSteps, vSteps, 2 * Math.PI, 2 * Math.PI);
    let indices = generateIndices(uSteps, vSteps);
    let lineIndices = generateLineIndices(uSteps, vSteps);
    
    surface.BufferData(data.verts, data.normals, data.uvs, data.tangents, data.bitangents, indices, lineIndices);
}

function resetView() {
    spaceball = new TrackballRotator(canvasGlobal, draw, 0);
}

function updateRenderSettings() {
    renderSettings.lightMode = document.querySelector('input[name="lightMode"]:checked').value;
    renderSettings.renderMode = document.querySelector('input[name="renderMode"]:checked').value;
    renderSettings.useDiffuse = document.getElementById("useDiffuseMap").checked;
    renderSettings.useSpecular = document.getElementById("useSpecularMap").checked;
    renderSettings.useNormal = document.getElementById("useNormalMap").checked;
    
}