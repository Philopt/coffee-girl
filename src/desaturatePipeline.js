export default class DesaturatePipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game, amount = 0.5) {
    super({
      game,
      renderTarget: true,
      fragShader: `
precision mediump float;
uniform sampler2D uMainSampler;
varying vec2 outTexCoord;
uniform float amount;
void main() {
  vec4 color = texture2D(uMainSampler, outTexCoord);
  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb = mix(color.rgb, vec3(gray), amount);
  gl_FragColor = color;
}`
    });
    this.amount = amount;
  }
  onPreRender() {
    this.set1f('amount', this.amount);
  }
}
