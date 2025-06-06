const canvas = document.getElementById('gameCanvas')
const c = canvas.getContext('2d')
const scoreC = document.getElementById('scoreC')
const startDiv = document.getElementById('start')
const gameOverDiv = document.getElementById('game-over')
let score = 0;

canvas.width = innerWidth
canvas.height = innerHeight

function startGame() {
    score = 0;
    startDiv.style.display = "none";
    gameOverDiv.style.display = "none";
    canvas.style.display = "block";
    animation();
}

function gameOver() {
    // Som ao perder
    let deathSound = new Audio("sound/pacman_death.wav");
    deathSound.play();

    setTimeout(() => {
        gameOverDiv.style.display = "block";
        canvas.style.display = "none";
        finalScore.innerHTML = score;
    }, 1000); // Atraso de um segundo para mudar a exibição da tela

}


function restartGame() {
    sessionStorage.setItem("restart", "true"); // Inclui a exibição de reiniciar
    location.reload(); // Recarregar a página
}

window.onload = function () {
    if (sessionStorage.getItem("restart") === "true") {
        sessionStorage.removeItem("restart"); // Limpar a exibição de reiniciar
        startGame(); // Inicia imediatamente após recarregar
    }
};


class Boundary {
    static width = 40
    static height = 40
    constructor({ position, image }) {
        this.position = position
        this.width = 40
        this.height = 40
        this.image = image
    }
    draw(debug = false) {
        if (debug) {
            c.fillStyle = 'rgba(255,0,0,0.3)';
            c.fillRect(this.position.x, this.position.y, this.width, this.height);
        }
        c.drawImage(this.image, this.position.x, this.position.y);
    }
}

class Pacman {
    constructor({ position, velocity }) {
        this.position = position;
        this.velocity = velocity;
        this.radius = 12;
        this.radians = 0.75;
        this.openRate = 0.03;
        this.rotation = 0; // 0 = direita, Math.PI/2 = baixo, Math.PI = esquerda, 3*Math.PI/2 = cima
    }

    draw() {
        c.save(); // Salva o estado atual da tela
        c.translate(this.position.x, this.position.y); // Move a origem para a posição atual do Pacman
        c.rotate(this.rotation); // Gira o personagem com base na direção

        // Desenha o Pacman centrado na nova origem (0,0 após executar translate)
        c.beginPath();
        c.arc(0, 0, this.radius, this.radians, Math.PI * 2 - this.radians);
        c.lineTo(0, 0);
        c.fillStyle = 'yellow';
        c.fill();
        c.closePath();

        c.restore(); // Restaura o estado da tela
    }

    update() {
        this.draw();

        // Atualizar a posição
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        // Atualizar a rotação com base em velocity (que é a direção)
        if (this.velocity.x > 0) this.rotation = 0; // Direita
        else if (this.velocity.x < 0) this.rotation = Math.PI; // Esquerda
        else if (this.velocity.y > 0) this.rotation = Math.PI / 2; // Cima
        else if (this.velocity.y < 0) this.rotation = Math.PI * 1.5; // Baixo

        // Animação de abertura e fechamento da boca    
        if (this.radians < 0 || this.radians > 0.75) {
            this.openRate = -this.openRate;
        }
        this.radians += this.openRate;
    }
}

class Ghost {
    static speed = 0.3
    constructor({ position, velocity, color = 'red', image, maze }) {
        this.position = position;
        this.velocity = { x: 0, y: 0 };
        this.radius = 13;
        this.color = color;
        this.prevCollisions = [];
        this.speed = Ghost.speed;
        this.image = image;
        this.maze = maze;
        this.target = null;
        this.mode = 'scatter';
        this.directionChanges = 0;

        // Canto para os fantasmas se espalharem
        this.scatterCorner = this.getScatterCorner();

        // Temporização para mudança de modo:
        this.modeTimer = 0;
        this.modeDuration = {
            scatter: 7000,
            chase: 20000
        };

        // Forçar decisão da direção
        this.changeDirection();
    }

    getScatterCorner() {
        // Definir cantos específicos para cada fantasma
        const corners = {
            'green': { x: Boundary.width * 9.5, y: Boundary.height * 1.5 },
            'pink': { x: Boundary.width * 1.5, y: Boundary.height * 1.5 },
            'white': { x: Boundary.width * 9.5, y: Boundary.height * 11.5 },
            'blue': { x: Boundary.width * 1.5, y: Boundary.height * 11.5 },
            'yellow': { x: Boundary.width * 9.5, y: Boundary.height * 6.5 },
            'red': { x: Boundary.width * 1.5, y: Boundary.height * 6.5 }
        };
        return corners[this.color] || { x: this.position.x, y: this.position.y };
    }
    draw() {
        c.drawImage(this.image, this.position.x - 12, this.position.y - 12)
    }
    changeDirection() {
        let validDirections = this.maze.getValidDirections(
            this.position.x,
            this.position.y,
            this.velocity
        );

        // Se não houver direção válida (beco sem saída), inverter a direção
        if (validDirections.length === 0) {
            this.velocity = {
                x: -this.velocity.x,
                y: -this.velocity.y
            };
            return;
        }

        // Constantes para verificar se o personagem está na borda
        const atLeftBorder = this.position.x <= this.radius;
        const atRightBorder = this.position.x >= (this.maze.map[0].length * this.maze.cellSize) - this.radius;
        const atTopBorder = this.position.y <= this.radius;
        const atBottomBorder = this.position.y >= (this.maze.map.length * this.maze.cellSize) - this.radius;

        // Se estiver em uma borda, obtenha direções válidas s/ considerar a velocidade atual
        if (atLeftBorder || atRightBorder || atTopBorder || atBottomBorder) {
            validDirections = this.maze.getValidDirections(
                this.position.x,
                this.position.y,
                { x: 0, y: 0 }
            );
        }


        // Se ñ houver direções válidas, inverta a direção
        if (validDirections.length === 0) {
            this.velocity = {
                x: -this.velocity.x,
                y: -this.velocity.y
            };
            return;
        }

        // Escolher direção com base no modo atual
        let chosenDirection;
        if (this.mode === 'scatter') {
            chosenDirection = this.chooseDirectionToTarget(validDirections, this.scatterCorner);
        } else {
            chosenDirection = this.chooseDirectionToTarget(validDirections, this.target);
        }
        this.velocity = {
            x: chosenDirection.x * this.speed,
            y: chosenDirection.y * this.speed
        };
    }
    // Método auxiliar para escolher a direção mais próxima do alvo
    chooseDirectionToTarget(directions, target) {
        let shortestDistance = Infinity;
        let chosen = directions[0]; // Padrão para a primeira direção

        for (const dir of directions) {
            const testX = this.position.x + dir.x * this.maze.cellSize * 3;
            const testY = this.position.y + dir.y * this.maze.cellSize * 3;

            const dist = Math.hypot(testX - target.x, testY - target.y);

            if (dist < shortestDistance) {
                shortestDistance = dist;
                chosen = dir;
            }
        }
        return chosen;
    }

    // Método auxiliar para verificar se o fantasma está na borda do canvas
    isAtBorder() {
        const buffer = 5; // Buffer de pixels para evitar que o personagem fique preso
        return (
            this.position.x <= buffer ||
            this.position.x >= (this.maze.map[0].length * this.maze.cellSize) - buffer ||
            this.position.y <= buffer ||
            this.position.y >= (this.maze.map.length * this.maze.cellSize) - buffer
        );
    }
    update() {
        this.draw();

        // Mudança de modo e verificação de NaN
        this.modeTimer += 16;
        if (this.mode === 'scatter' && this.modeTimer > this.modeDuration.scatter) {
            this.setMode('chase');
            this.modeTimer = 0;
        } else if (this.mode === 'chase' && this.modeTimer > this.modeDuration.chase) {
            this.setMode('scatter');
            this.modeTimer = 0;
        }

        // Verificações de NaN
        if (isNaN(this.position.x)) this.position.x = this.maze.cellSize * 5;
        if (isNaN(this.position.y)) this.position.y = this.maze.cellSize * 5;

        // Calcular a próxima posição
        const nextX = this.position.x + this.velocity.x;
        const nextY = this.position.y + this.velocity.y;

        // Verificar se a próxima posição é um muro
        if (!this.maze.isWall(nextX, nextY, this.radius)) {
            // Mover-se normalmente se o caminho estiver livre
            this.position.x = nextX;
            this.position.y = nextY;
        } else {
            // Manipulação da colisão com paredes
            this.handleWallCollision(nextX, nextY);
        }

        // Verificar se o fantasma está em um ponto de decisão
        const atDecisionPoint =
            Math.abs(this.position.x % this.maze.cellSize - this.maze.cellSize / 2) < 2 &&
            Math.abs(this.position.y % this.maze.cellSize - this.maze.cellSize / 2) < 2;

        if (atDecisionPoint) {
            this.changeDirection();
        }

        // Forçar respeito às bordas
        const maxX = (this.maze.map[0].length - 1) * this.maze.cellSize;
        const maxY = (this.maze.map.length - 1) * this.maze.cellSize;
        const buffer = 2;

        if (this.position.x < buffer) {
            this.position.x = buffer;
            this.changeDirection();
        } else if (this.position.x > maxX - buffer) {
            this.position.x = maxX - buffer;
            this.changeDirection();
        }

        if (this.position.y < buffer) {
            this.position.y = buffer;
            this.changeDirection();
        } else if (this.position.y > maxY - buffer) {
            this.position.y = maxY - buffer;
            this.changeDirection();
        }
    }


    handleWallCollision(nextX, nextY) {
        // Tentar movimentar-se apenas na horizontal
        if (!this.maze.isWall(nextX, this.position.y, this.radius)) {
            this.position.x = nextX;
            this.velocity.y = 0;
            return;
        }

        // Tentar movimentar-se apenas na vertical
        if (!this.maze.isWall(this.position.x, nextY, this.radius)) {
            this.position.y = nextY;
            this.velocity.x = 0;
            return;
        }

        // Se ambas as direções estiverem bloqueadas, ir para o centro da célula atual
        const cellX = Math.round(this.position.x / this.maze.cellSize);
        const cellY = Math.round(this.position.y / this.maze.cellSize);
        this.position.x = cellX * this.maze.cellSize + this.maze.cellSize / 2;
        this.position.y = cellY * this.maze.cellSize + this.maze.cellSize / 2;
        this.changeDirection();
    }



    setTarget(targetPosition) {
        // Quando no modo scatter (espalhar), usar o canto definido para o fantasma
        if (this.mode === 'scatter') {
            this.target = this.scatterCorner;
            return;
        }

        // No modo perseguição (chase), validar o destino com verificações 
        if (this.mode === 'chase') {
            // Verificar se o destino é válido
            if (targetPosition &&
                !isNaN(targetPosition.x) &&
                !isNaN(targetPosition.y) &&
                targetPosition.x >= 0 &&
                targetPosition.y >= 0 &&
                targetPosition.x <= this.maze.map[0].length * this.maze.cellSize &&
                targetPosition.y <= this.maze.map.length * this.maze.cellSize) {

                this.target = targetPosition;
            } else {
                // Se o destino for inválido, usar o canto definido para o fantasma como plano B
                this.target = this.scatterCorner;
            }
        }
    }

    // Define o modo
    setMode(mode) {
        this.mode = mode;
    }
}




class Pellet {
    constructor({ position }) {
        this.position = position;
        this.radius = 3;
    }

    draw() {
        c.beginPath()
        c.arc(this.position.x, this.position.y,
            this.radius, 0, Math.PI * 2)
        c.fillStyle = 'purple'
        c.fill()
        c.closePath();
    }
}




const pellets = []
const boundaries = []

const map = [
    ['1', '_', '_', '_', '_', '_', '_', '_', '_', '_', '2'],
    ['|', ' ', '.', '.', '.', '.', '.', '.', '.', '.', '|'],
    ['|', '.', 'b', '.', 'l', 'bc', 'r', '.', 'b', '.', '|'],
    ['|', '.', '.', '.', '.', 'd', '.', '.', '.', '.', '|'],
    ['|', '.', 'l', 'r', '.', '.', '.', 'l', 'r', '.', '|'],
    ['|', '.', '.', '.', '.', 't', '.', '.', '.', '.', '|'],
    ['|', '.', 'b', '.', 'l', 'c', 'r', '.', 'b', '.', '|'],
    ['|', '.', '.', '.', '.', 'd', '.', '.', '.', '.', '|'],
    ['|', '.', 'l', 'r', '.', '.', '.', 'l', 'r', '.', '|'],
    ['|', '.', '.', '.', '.', 't', '.', '.', '.', '.', '|'],
    ['|', '.', 'b', '.', 'l', 'tc', 'r', '.', 'b', '.', '|'],
    ['|', '.', '.', '.', '.', '.', '.', '.', '.', '.', '|'],
    ['4', '_', '_', '_', '_', '_', '_', '_', '_', '_', '3']
];

function createImage(src) {
    const image = new Image()
    image.src = src
    return image
}

//Popula o mapa com cada elemento, usando imagens e caracteres
map.forEach((row, i) => {
    row.forEach((symbol, j) => {
        switch (symbol) {
            case '_':
                boundaries.push(new Boundary({
                    position:
                    {
                        x: Boundary.width * j,
                        y: Boundary.height * i
                    },
                    image: createImage('./img/pipeHorizontal.png')
                }));
                break
            case '|':
                boundaries.push(new Boundary({
                    position:
                    {
                        x: Boundary.width * j,
                        y: Boundary.height * i
                    },
                    image: createImage('./img/pipeVertical.png')
                }));
                break
            case '1':
                boundaries.push(new Boundary({
                    position:
                    {
                        x: Boundary.width * j,
                        y: Boundary.height * i
                    },
                    image: createImage('./img/pipeCorner1.png')
                }));
                break
            case '2':
                boundaries.push(new Boundary({
                    position:
                    {
                        x: Boundary.width * j,
                        y: Boundary.height * i
                    },
                    image: createImage('./img/pipeCorner2.png')
                }));
                break
            case '3':
                boundaries.push(new Boundary({
                    position:
                    {
                        x: Boundary.width * j,
                        y: Boundary.height * i
                    },
                    image: createImage('./img/pipeCorner3.png')
                }));
                break
            case '4':
                boundaries.push(new Boundary({
                    position:
                    {
                        x: Boundary.width * j,
                        y: Boundary.height * i
                    },
                    image: createImage('./img/pipeCorner4.png')
                }));
                break
            case 'b':
                boundaries.push(new Boundary({
                    position:
                    {
                        x: Boundary.width * j,
                        y: Boundary.height * i
                    },
                    image: createImage('./img/block.png')
                }));
                break
            case 't':
                boundaries.push(new Boundary({
                    position:
                    {
                        x: Boundary.width * j,
                        y: Boundary.height * i
                    },
                    image: createImage('./img/capTop.png')
                }));
                break
            case 'd':
                boundaries.push(new Boundary({
                    position:
                    {
                        x: Boundary.width * j,
                        y: Boundary.height * i
                    },
                    image: createImage('./img/capBottom.png')
                }));
                break
            case 'l':
                boundaries.push(new Boundary({
                    position:
                    {
                        x: Boundary.width * j,
                        y: Boundary.height * i
                    },
                    image: createImage('./img/capLeft.png')
                }));
                break
            case 'r':
                boundaries.push(new Boundary({
                    position:
                    {
                        x: Boundary.width * j,
                        y: Boundary.height * i
                    },
                    image: createImage('./img/capRight.png')
                }));
                break
            case 'bc':
                boundaries.push(new Boundary({
                    position:
                    {
                        x: Boundary.width * j,
                        y: Boundary.height * i
                    },
                    image: createImage('./img/pipeConnectorBottom.png')
                }));
                break
            case 'tc':
                boundaries.push(new Boundary({
                    position:
                    {
                        x: Boundary.width * j,
                        y: Boundary.height * i
                    },
                    image: createImage('./img/pipeConnectorTop.png')
                }));
                break
            case 'c':
                boundaries.push(new Boundary({
                    position:
                    {
                        x: Boundary.width * j,
                        y: Boundary.height * i
                    },
                    image: createImage('./img/pipeCross.png')
                }));
                break
            case '.':
                pellets.push(new Pellet({
                    position:
                    {
                        x: Boundary.width * j + Boundary.width / 2,
                        y: Boundary.height * i + Boundary.height / 2
                    },
                }));
                break
        }
    });
});

class Maze {
    constructor(map, cellSize) {
        this.map = map;
        this.cellSize = cellSize;
        this.wallSymbols = ['_', '|', '1', '2', '3', '4', 'b', 't', 'd', 'l', 'r', 'bc', 'tc', 'c'];
    }

    isWall(x, y, radius = 0) {
        // Converter coordenadas em pixel para coordenadas de grade
        const gridX = Math.floor(x / this.cellSize);
        const gridY = Math.floor(y / this.cellSize);

        // Verificar se a posição está fora dos limites
        if (gridY < 0 || gridY >= this.map.length ||
            gridX < 0 || gridX >= this.map[0].length) {
            return true;
        }

        // Verificar se a célula é uma parede
        const isWallCell = this.wallSymbols.includes(this.map[gridY][gridX]);

        // Verificação de bordas reforçada
        if (!isWallCell) {
            const cellLeft = gridX * this.cellSize;
            const cellRight = (gridX + 1) * this.cellSize;
            const cellTop = gridY * this.cellSize;
            const cellBottom = (gridY + 1) * this.cellSize;

            // Calcular a profundidade da penetração
            const leftPenetration = (cellLeft - x) + radius;
            const rightPenetration = (x - cellRight) + radius;
            const topPenetration = (cellTop - y) + radius;
            const bottomPenetration = (y - cellBottom) + radius;

            // Verificar as células adjacentes caso esteja próximo à borda
            if (leftPenetration > 0 && gridX > 0 &&
                this.wallSymbols.includes(this.map[gridY][gridX - 1])) {
                return true;
            }
            if (rightPenetration > 0 && gridX < this.map[0].length - 1 &&
                this.wallSymbols.includes(this.map[gridY][gridX + 1])) {
                return true;
            }
            if (topPenetration > 0 && gridY > 0 &&
                this.wallSymbols.includes(this.map[gridY - 1][gridX])) {
                return true;
            }
            if (bottomPenetration > 0 && gridY < this.map.length - 1 &&
                this.wallSymbols.includes(this.map[gridY + 1][gridX])) {
                return true;
            }
        }

        return isWallCell;
    }

    getValidDirections(x, y, currentVelocity) {
        const directions = [
            { x: 0, y: -1, name: 'up' },    // up
            { x: 1, y: 0, name: 'right' },  // right
            { x: 0, y: 1, name: 'down' },   // down
            { x: -1, y: 0, name: 'left' }   // left
        ];

        // Converter em coordenadas de grade
        const gridX = Math.floor(x / this.cellSize);
        const gridY = Math.floor(y / this.cellSize);

        return directions.filter(dir => {
            // Não permitir viradas de 180 graus (exceto em becos sem saída)
            if (currentVelocity &&
                dir.x === -currentVelocity.x &&
                dir.y === -currentVelocity.y) {
                return false;
            }

            // Verificar se a próxima célula é válida
            const nextX = gridX + dir.x;
            const nextY = gridY + dir.y;

            // Verificar bordas
            if (nextY < 0 || nextY >= this.map.length ||
                nextX < 0 || nextX >= this.map[0].length) {
                return false;
            }

            return !this.wallSymbols.includes(this.map[nextY][nextX]);
        });
    }
}

const maze = new Maze(map, Boundary.width);

// Criar fantasmas após o labirinto estar renderizado
const ghosts = [
    // Fantasma verde (corredor superior central)
    new Ghost({
        position: {
            x: Boundary.width * 5 + Boundary.width / 2,
            y: Boundary.height * 1 + Boundary.height / 2
        },
        velocity: { x: Ghost.speed, y: 0 },
        image: createImage('./img/greenG.png'),
        color: 'green',
        maze: maze
    }),
    // Fantasma rosa (corredor superior esquerdo)
    new Ghost({
        position: {
            x: Boundary.width * 1 + Boundary.width / 2,
            y: Boundary.height * 6 + Boundary.height / 2
        },
        velocity: { x: Ghost.speed, y: 0 },
        image: createImage('./img/pinkG.png'),
        color: 'pink',
        maze: maze
    }),
    // Fantasma branco (corredor superior direito)
    new Ghost({
        position: {
            x: Boundary.width * 9 + Boundary.width / 2,
            y: Boundary.height * 3 + Boundary.height / 2
        },
        velocity: { x: -Ghost.speed, y: 0 },
        image: createImage('./img/whiteG.png'),
        color: 'white',
        maze: maze
    }),
    // Fantasma azul (corredor inferior direito)
    new Ghost({
        position: {
            x: Boundary.width * 4 + Boundary.width / 2,
            y: Boundary.height * 9 + Boundary.height / 2
        },
        velocity: { x: Ghost.speed, y: 0 },
        image: createImage('./img/blueG.png'),
        color: 'blue',
        maze: maze
    }),
    // Fantasma amarelo (corredor inferior esquerdo)
    new Ghost({
        position: {
            x: Boundary.width * 2 + Boundary.width / 2,
            y: Boundary.height * 8 + Boundary.width / 2
        },
        velocity: { x: Ghost.speed, y: 0 },
        image: createImage('./img/yellowG.png'),
        color: 'yellow',
        maze: maze
    }),
    // Fantasma vermelho (corredro extrema esquerda)
    new Ghost({
        position: {
            x: Boundary.width * 1 + Boundary.width / 2,
            y: Boundary.height * 8 + Boundary.height / 2
        },
        velocity: { x: Ghost.speed, y: 0 },
        image: createImage('./img/redG.png'),
        color: 'red',
        maze: maze
    })
];

const pacman = new Pacman({
    position: {
        x: Boundary.width + Boundary.width / 2,
        y: Boundary.height + Boundary.height / 2
    },
    velocity: {
        x: 0,
        y: 0
    }
});

let lastKey = ''
const keys = {
    ArrowUp: false,
    ArrowLeft: false,
    ArrowDown: false,
    ArrowRight: false
};


function circleWithRect({ circle, rectangle }) {
    const circleX = circle.position.x + circle.velocity.x;
    const circleY = circle.position.y + circle.velocity.y;

    const rectX = rectangle.position.x;
    const rectY = rectangle.position.y;
    const rectWidth = rectangle.width;
    const rectHeight = rectangle.height;

    // Find closest point on rectangle to circle
    const closestX = Math.max(rectX, Math.min(circleX, rectX + rectWidth));
    const closestY = Math.max(rectY, Math.min(circleY, rectY + rectHeight));

    // Calculate distance
    const distanceX = circleX - closestX;
    const distanceY = circleY - closestY;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

    return distance < circle.radius;
}

let animationId
let currentGhostSpeed = Ghost.speed;

function animation() {
    animationId = requestAnimationFrame(animation);
    c.clearRect(0, 0, canvas.width, canvas.height);

    // Atualizar ponto de destino para os fantasmas para que sigam o Pac-man
    ghosts.forEach(ghost => {
        ghost.setTarget(pacman.position);
    });

    // Tecla de entrada para pacman + colisões com a parede 
    if (keys.ArrowUp) {
        // Attempt to move up
        pacman.velocity.x = 0;
        pacman.velocity.y = -3;

        // Verificar se mover para cima bateria na parede
        let canMove = true;
        boundaries.forEach(boundary => {
            if (circleWithRect({
                circle: {
                    position: {
                        x: pacman.position.x,
                        y: pacman.position.y + pacman.velocity.y
                    },
                    radius: pacman.radius,
                    velocity: { x: 0, y: 0 }
                },
                rectangle: boundary
            })) {
                canMove = false;
            }
        });
        if (!canMove) {
            pacman.velocity.y = 0;
        }
    }
    else if (keys.ArrowLeft) {
        // Tentar ir para a esquerda
        pacman.velocity.x = -3;
        pacman.velocity.y = 0;

        // Verificar se mover para a esquerda bateria na parede
        let canMove = true;
        boundaries.forEach(boundary => {
            if (circleWithRect({
                circle: {
                    position: {
                        x: pacman.position.x + pacman.velocity.x,
                        y: pacman.position.y
                    },
                    radius: pacman.radius,
                    velocity: { x: 0, y: 0 }
                },
                rectangle: boundary
            })) {
                canMove = false;
            }
        });
        if (!canMove) {
            pacman.velocity.x = 0;
        }
    }
    else if (keys.ArrowDown) {
        // Tentar ir para baixo
        pacman.velocity.x = 0;
        pacman.velocity.y = 3;

        // Verificar se mover para baixo bateria na parede
        let canMove = true;
        boundaries.forEach(boundary => {
            if (circleWithRect({
                circle: {
                    position: {
                        x: pacman.position.x,
                        y: pacman.position.y + pacman.velocity.y
                    },
                    radius: pacman.radius,
                    velocity: { x: 0, y: 0 }
                },
                rectangle: boundary
            })) {
                canMove = false;
            }
        });
        if (!canMove) {
            pacman.velocity.y = 0;
        }
    }
    else if (keys.ArrowRight) {
        // Tentar ir para cima
        pacman.velocity.x = 3;
        pacman.velocity.y = 0;

        // Verificar se mover para a direita bateria na parede
        let canMove = true;
        boundaries.forEach(boundary => {
            if (circleWithRect({
                circle: {
                    position: {
                        x: pacman.position.x + pacman.velocity.x,
                        y: pacman.position.y
                    },
                    radius: pacman.radius,
                    velocity: { x: 0, y: 0 }
                },
                rectangle: boundary
            })) {
                canMove = false;
            }
        });
        if (!canMove) {
            pacman.velocity.x = 0;
        }
    }
    else {
        // Nenhuma tecla pressionada - deixar pacman parado
        pacman.velocity.x = 0;
        pacman.velocity.y = 0;
    }

    // Atualizar o pacman - desenhar e realizar um movimento apenas
    pacman.update();

    // Manter o pacman dentro dos limites da tela de jogo
    pacman.position.x = Math.max(
        pacman.radius,
        Math.min(pacman.position.x, canvas.width - pacman.radius)
    );
    pacman.position.y = Math.max(
        pacman.radius,
        Math.min(pacman.position.y, canvas.height - pacman.radius)
    );

    // Gerenciar as bolinhas comestíveis, fazendo desaparecer ao comer e atualizando o score
    pellets.forEach((pellet, i) => {
        const dist = Math.hypot(
            pellet.position.x - pacman.position.x,
            pellet.position.y - pacman.position.y
        );
        if (dist < pellet.radius + pacman.radius) {
            let eatPellet = new Audio("sound/pacman_chomp.wav");
            eatPellet.play();
            pellets.splice(i, 1);
            score += 10;
            scoreC.innerHTML = score;
        } else {
            pellet.draw();
        }
    });

    // Desenhar os limites 
    boundaries.forEach(boundary => boundary.draw());

    // Atualizar os fantasmas
    ghosts.forEach((ghost, index) => {
        ghost.update();

        // Se um fantasma encostar no pac-man, fim de jogo - fórmula euclideana
        const distToPac = Math.hypot(
            ghost.position.x - pacman.position.x,
            ghost.position.y - pacman.position.y
        );
        if (distToPac < ghost.radius + pacman.radius) {
            cancelAnimationFrame(animationId);
            gameOver();
        }
    });



    // Condição de mudança de nível - reabastecer bolinhas quando todas forem comidas
    if (pellets.length === 0) {
        refillMapWithPellets();
    }
}


function refillMapWithPellets() {
    pellets.length = 0;
    map.forEach((row, i) => {
        row.forEach((symbol, j) => {
            if (symbol === '.') {
                pellets.push(new Pellet({
                    position: {
                        x: Boundary.width * j + Boundary.width / 2,
                        y: Boundary.height * i + Boundary.height / 2
                    },
                }));
            }
        });
    });
    currentGhostSpeed += 0.3; // Aumentar velocidade dos fantasmas a cada mudança de nível
    updateGhostSpeed();
}

function updateGhostSpeed() {
    ghosts.forEach((ghost) => {
        ghost.speed = currentGhostSpeed;
    });
}

window.addEventListener('keydown', (event) => {
    if (["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(event.key)) {
        event.preventDefault(); // evitar que a rolagem seja feita no navegador
        keys[event.key] = true; // Armazenar o estado de pressionamento
    }
});

window.addEventListener('keyup', (event) => {
    if (["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(event.key)) {
        keys[event.key] = false; // Resetar o estado de pressionamento ao soltar
    }
});

