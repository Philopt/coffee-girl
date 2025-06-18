class GameState {
  constructor(){
    this.money = 10.00;
    this.love = 10;
    this.queue = [];
    this.activeCustomer = null;
    this.wanderers = [];
    this.sparrows = [];
    this.spawnTimer = null;
    this.falconActive = false;
    this.gameOver = false;
    this.loveLevel = 1;
    this.servedCount = 0;
    this.heartWin = null;
    this.girlReady = false;
    this.truck = null;
  }
}

export default new GameState();
