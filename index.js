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
    gameOverDiv.style.display = "block";
    canvas.style.display = "none";
    finalScore.innerHTML = score;
}

function restartGame() {
    location.reload()
    startGame();
}

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
        this.openRate = .03;
    }

    draw() {
        c.beginPath();
        c.arc(this.position.x, this.position.y,
            this.radius, this.radians, Math.PI * 2 - this.radians);
        c.lineTo(this.position.x, this.position.y);
        c.fillStyle = 'yellow';
        c.fill();
        c.closePath();
    }

    update() {
        this.draw();
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
    }
}

class Ghost {
    static speed = 2
    constructor({ position, velocity, color = 'red', image, maze }) {
        this.position = position;
        // ← ignore the “velocity” parameter entirely; we’ll compute our own:
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

        // Scatter corner:
        this.scatterCorner = this.getScatterCorner();

        // Mode timing:
        this.modeTimer = 0;
        this.modeDuration = {
            scatter: 7000,
            chase: 20000
        };

        // ← **NEW LINE**: Right after all that, force an AI decision:
        this.changeDirection();
    }

    getScatterCorner() {
        // Define specific corners for each ghost color
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

        // If no valid directions, reverse (dead end)
        if (validDirections.length === 0) {
            this.velocity = {
                x: -this.velocity.x,
                y: -this.velocity.y
            };
            return;
        }

        // Tratamento especial para bordas
        const atLeftBorder = this.position.x <= this.radius;
        const atRightBorder = this.position.x >= (this.maze.map[0].length * this.maze.cellSize) - this.radius;
        const atTopBorder = this.position.y <= this.radius;
        const atBottomBorder = this.position.y >= (this.maze.map.length * this.maze.cellSize) - this.radius;

        // Se estiver em uma borda, obtenha direções válidas sem considerar a velocidade atual
        if (atLeftBorder || atRightBorder || atTopBorder || atBottomBorder) {
            validDirections = this.maze.getValidDirections(
                this.position.x,
                this.position.y,
                { x: 0, y: 0 }
            );
        }


        // Se não houver direções válidas, inverta a direção
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
        } else if (this.mode === 'chase') {
            chosenDirection = this.chooseDirectionToTarget(validDirections, this.target);
        } else {
            // Para o modo assustado, escolha aleatoriamente
            chosenDirection = validDirections[Math.floor(Math.random() * validDirections.length)];
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
        const buffer = 5; // Pixel buffer
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

        // Border enforcement
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
        // Try moving only horizontally
        if (!this.maze.isWall(nextX, this.position.y, this.radius)) {
            this.position.x = nextX;
            this.velocity.y = 0;
            return;
        }

        // Try moving only vertically
        if (!this.maze.isWall(this.position.x, nextY, this.radius)) {
            this.position.y = nextY;
            this.velocity.x = 0;
            return;
        }

        // If both directions are blocked, snap to center of current cell
        const cellX = Math.round(this.position.x / this.maze.cellSize);
        const cellY = Math.round(this.position.y / this.maze.cellSize);
        this.position.x = cellX * this.maze.cellSize + this.maze.cellSize / 2;
        this.position.y = cellY * this.maze.cellSize + this.maze.cellSize / 2;
        this.changeDirection();
    }



    setTarget(targetPosition) {
        // In scatter mode, use the ghost's scatter corner
        if (this.mode === 'scatter') {
            this.target = this.scatterCorner;
            return;
        }

        // In chase mode, validate the target carefully
        if (this.mode === 'chase') {
            // Check if target is valid
            if (targetPosition &&
                !isNaN(targetPosition.x) &&
                !isNaN(targetPosition.y) &&
                targetPosition.x >= 0 &&
                targetPosition.y >= 0 &&
                targetPosition.x <= this.maze.map[0].length * this.maze.cellSize &&
                targetPosition.y <= this.maze.map.length * this.maze.cellSize) {

                this.target = targetPosition;
            } else {
                // If target is invalid, use scatter corner
                this.target = this.scatterCorner;
            }
        }
    }


    setMode(mode) {
        this.mode = mode;
        // In frightened mode, ghosts move slower
        this.speed = mode === 'frightened' ? 1 : Ghost.speed;
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
        c.fillStyle = 'white'
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
        // Convert pixel coordinates to grid coordinates
        const gridX = Math.floor(x / this.cellSize);
        const gridY = Math.floor(y / this.cellSize);

        // Check if position is out of bounds
        if (gridY < 0 || gridY >= this.map.length ||
            gridX < 0 || gridX >= this.map[0].length) {
            return true;
        }

        // Check if the cell is a wall
        const isWallCell = this.wallSymbols.includes(this.map[gridY][gridX]);

        // More precise edge checking
        if (!isWallCell) {
            const cellLeft = gridX * this.cellSize;
            const cellRight = (gridX + 1) * this.cellSize;
            const cellTop = gridY * this.cellSize;
            const cellBottom = (gridY + 1) * this.cellSize;

            // Calculate penetration depth
            const leftPenetration = (cellLeft - x) + radius;
            const rightPenetration = (x - cellRight) + radius;
            const topPenetration = (cellTop - y) + radius;
            const bottomPenetration = (y - cellBottom) + radius;

            // Check adjacent cells if we're near an edge
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

        // Convert to grid coordinates
        const gridX = Math.floor(x / this.cellSize);
        const gridY = Math.floor(y / this.cellSize);

        return directions.filter(dir => {
            // Don't allow 180-degree turns (except in dead ends)
            if (currentVelocity &&
                dir.x === -currentVelocity.x &&
                dir.y === -currentVelocity.y) {
                return false;
            }

            // Check if next cell is valid
            const nextX = gridX + dir.x;
            const nextY = gridY + dir.y;

            // Check bounds
            if (nextY < 0 || nextY >= this.map.length ||
                nextX < 0 || nextX >= this.map[0].length) {
                return false;
            }

            return !this.wallSymbols.includes(this.map[nextY][nextX]);
        });
    }
}

const maze = new Maze(map, Boundary.width);

// Create ghosts after maze is initialized
// Update the ghost initialization code to:
const ghosts = [
    // Green Ghost (Top-middle corridor)
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
    // Pink Ghost (Middle-left corridor)
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
    // White Ghost (Top-right corridor)
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
    // Blue Ghost (Bottom-right corridor)
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
    // Yellow Ghost (Bottom-left corridor)
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
    // Red Ghost (Far-left corridor)
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
    w: { pressed: false },
    a: { pressed: false },
    s: { pressed: false },
    d: { pressed: false }
}

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

    // 1) Update ghost targets so they follow Pac-Man
    ghosts.forEach(ghost => {
        ghost.setTarget(pacman.position);
    });

    // 2) HANDLE PAC-MAN INPUT + COLLISION CHECKS (remove any manual position += here)
    if (keys.w.pressed) {
        // Attempt to move up
        pacman.velocity.x = 0;
        pacman.velocity.y = -3;

        // Check if moving up would hit a wall
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
    else if (keys.a.pressed) {
        // Attempt to move left
        pacman.velocity.x = -3;
        pacman.velocity.y = 0;

        // Check if moving left would hit a wall
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
    else if (keys.s.pressed) {
        // Attempt to move down
        pacman.velocity.x = 0;
        pacman.velocity.y = 3;

        // Check if moving down would hit a wall
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
    else if (keys.d.pressed) {
        // Attempt to move right
        pacman.velocity.x = 3;
        pacman.velocity.y = 0;

        // Check if moving right would hit a wall
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
        // No key pressed → stop Pac-Man completely
        pacman.velocity.x = 0;
        pacman.velocity.y = 0;
    }

    // 3) UPDATE PAC-MAN (draw + move exactly once)
    pacman.update();

    // 4) CLAMP PAC-MAN INSIDE THE CANVAS BOUNDS
    pacman.position.x = Math.max(
        pacman.radius,
        Math.min(pacman.position.x, canvas.width - pacman.radius)
    );
    pacman.position.y = Math.max(
        pacman.radius,
        Math.min(pacman.position.y, canvas.height - pacman.radius)
    );

    // 5) HANDLE PELLETS
    pellets.forEach((pellet, i) => {
        const dist = Math.hypot(
            pellet.position.x - pacman.position.x,
            pellet.position.y - pacman.position.y
        );
        if (dist < pellet.radius + pacman.radius) {
            pellets.splice(i, 1);
            score += 10;
            scoreC.innerHTML = score;
        } else {
            pellet.draw();
        }
    });

    // 6) DRAW BOUNDARIES
    boundaries.forEach(boundary => boundary.draw());

    // 7) UPDATE GHOSTS
    ghosts.forEach((ghost, index) => {  // Add index parameter here
        console.log(`Ghost ${index}:`, {
            position: ghost.position,
            target: ghost.target,
            velocity: ghost.velocity,
            mode: ghost.mode
        });
        ghost.update();

        // If a ghost touches Pac-Man, game over
        const distToPac = Math.hypot(
            ghost.position.x - pacman.position.x,
            ghost.position.y - pacman.position.y
        );
        if (distToPac < ghost.radius + pacman.radius) {
            cancelAnimationFrame(animationId);
            gameOver();
        }
    });



    // 8) WIN CONDITION: refill pellets when all are eaten
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
    currentGhostSpeed += 0.5; // Increase ghost speed slightly each level
    updateGhostSpeed();
}

function updateGhostSpeed() {
    ghosts.forEach((ghost) => {
        ghost.speed = currentGhostSpeed;
    });
}

window.addEventListener('keydown', ({ key }) => {
    switch (key) {
        case 'w':
            keys.w.pressed = true
            break
        case 'a':
            keys.a.pressed = true
            break
        case 's':
            keys.s.pressed = true
            break
        case 'd':
            keys.d.pressed = true
            break
    }
});

window.addEventListener('keyup', ({ key }) => {
    switch (key) {
        case 'w':
            keys.w.pressed = false
            break
        case 'a':
            keys.a.pressed = false
            break
        case 's':
            keys.s.pressed = false
            break
        case 'd':
            keys.d.pressed = false
            break
    }
});