// 2012 Chris Longo (cal@chrislongo.net)

var canvasDemo = new function() 
{
    var context;
    var buffer;
    var bufferContext;
    var imageData;
    var palette;
    var colorMap;
    var width;
    var height;
    var scale = 2;
    var fan = 2.5;
    var start = new Date();
    var frames = 0;
    var slack = 5;

    this.canvas = undefined;

    this.init = function()
    {
        context = this.canvas.getContext('2d');

        width = this.canvas.width / scale;
        height = this.canvas.height / scale;

        colorMap = Array(width * height);

        for(var i = 0; i < colorMap.length; i++)
            colorMap[i] = 0;

        initPalette();
        initBuffer();

        update();
    };

    // init palette from warm to white hot colors
    var initPalette = function()
    {
        palette = Array(256);

        for(var i = 0; i < 64; i++)
        {
            palette[i] = [(i << 2), 0, 0];
            palette[i + 64] = [255, (i << 2), 0];
            palette[i + 128] = [255, 255, (i << 2)];
            palette[i + 192] = [255, 255, 255];
        }
    };

    // offscreen buffer for rendering and scaling
    var initBuffer = function()
    {
        buffer = document.createElement('canvas');
        buffer.width = width;
        buffer.height = height;
        buffer.style.visibility = 'hidden';
        
        bufferContext = buffer.getContext("2d");
        imageData = bufferContext.createImageData(width, height);
    };

    // main render loop
    var update = function()
    {
        smooth();
        draw();
        frames++;

        requestAnimFrame(function() { update(); });
    };

    // take the middle pixel and average it with the surrounding pixels
    // then write it one veritcal pixel up
    //
    // v1|v2|v3
    // v4|**|v5
    // v6|v7|v8
    var smooth = function()
    {
        for(var x = width - 1; x >= 1; x--)
        {
            for(var y = height; y--;)
            {
                var p = ((
                    colorMap[toIndex(x - 1, y - 1)] +
                    colorMap[toIndex(x, y - 1)] +
                    colorMap[toIndex(x + 1, y - 1)] +
                    colorMap[toIndex(x - 1, y)] +
                    colorMap[toIndex(x + 1, y)] +
                    colorMap[toIndex(x - 1, y + 1)] +
                    colorMap[toIndex(x, y + 1)] +
                    colorMap[toIndex(x + 1, y + 1)]) >> 3);

                p = Math.max(0, p - randomValue(fan));

                colorMap[toIndex(x, y - 1)] = p;

                if(y < height - slack) // don't draw random noise in bottom rows
                {
                    if(y < height - 2)
                    {
                        // set two lines of random palette noise at bottom of
                        // colorMap
                        colorMap[toIndex(x, height)] =
                            randomValue(palette.length);
                        colorMap[toIndex(x, height - 1)] =
                            randomValue(palette.length);
                    }

                    drawPixel(x, y, palette[colorMap[toIndex(x, y)]]);
                }
            }
        }
    };

    // draw colormap->palette values to screen
    var draw = function()
    {
        // render the image data to the offscreen buffer...
        bufferContext.putImageData(imageData, 0, 0);
        // ...then draw it to scale to the onscreen canvas
        context.drawImage(buffer, 0, 0, width * scale, height * scale);
    };

    // set pixels in imageData
    var drawPixel = function(x, y, color)
    {
        var offset = (x + y * imageData.width) * 4;
        imageData.data[offset] = color[0];
        imageData.data[offset + 1] = color[1];
        imageData.data[offset + 2] = color[2];
        imageData.data[offset + 3] = 255;
    };

    var clear = function()
    {
        bufferContext.clearRect(0, 0, width, height - (5 + slack));
    };

    var randomValue = function(max)
    {
        // protip: a double bitwise not (~~) is much faster than
        // Math.floor() for truncating floating point values into "ints"
        return ~~(Math.random() * max);
    };

    // because "two-dimensional" arrays in JavaScript suck
    var toIndex = function(x, y)
    {
        return (y * width + x);
    };

    // burns an image to screen using a binary pixel map
    // if the map's pixel is white (on) a random palette color is burned into
    // that place onscreen
    this.drawOverlay = function(image)
    {
        clear();

        bufferContext.drawImage(image, 0, 0, width, height);
        var data = bufferContext.getImageData(0, 0, width, height).data;

        for(var x = width; x--;)
        {
            for(var y = height; y--;)
            {
                var index = toIndex(x - 0, y - 0);

                // it's a binary color mask (black or white)
                // so if any RGB component is set, it's white, right? ;)
                if(data[(x + y * width) * 4] !== 0)
                    colorMap[index] = randomValue(palette.length);
                else
                    colorMap[index] = 0;
            }
        }
    };

    // draw a bunch of random embers onscreen
    this.drawEmbers = function()
    {
        for(var x = 1; x < width - 1; x++)
        {
            for(var y = 1; y < height; y++)
            {
                if(Math.random() < 0.11)
                    colorMap[toIndex(x, y)] = randomValue(palette.length);
            }
        }
    };

    // fans the flames down
    this.fanDown = function()
    {
        fan = Math.min(6, fan + 0.5);
    };

    // fans the flame up
    this.fanUp = function()
    {
        fan = Math.max(-1, fan - 0.5);
    };

    this.framerate = function()
    {
        var now = new Date();
        var seconds = (now - start) / 1000;
        var rate = frames / seconds;

        start = now;
        frames = 0;

        return Math.round(rate);
    };
};

window.requestAnimFrame = (function(callback){
    return window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function(callback){
        window.setTimeout(callback, 1000 / 60);
    };
})();