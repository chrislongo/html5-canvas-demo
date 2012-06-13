var canvasDemo = new function() 
{
    var context;
    var offScreenContext;
    var palette;
    var colorMap;
    var coolingMap;
    var width;
    var height;
    var scale = 2;
    var fan = 0;
    var start;
    var frames = 0;
    var interleave = 0;
    var slack = 5;

    this.init = function(canvasElement)
    {
         initPalette();

         element = document.getElementById(canvasElement);
         width = element.width;
         height = element.height;

         colorMap = Array(width * height / scale);
         coolingMap = Array(width * height / scale);

         for(var i = 0; i < colorMap.length; i++)
            colorMap[i] = 0;

         initCoolingMap();
         initOffScreenContext();

         context = element.getContext('2d');

         start = new Date().getTime();

         clear();
         update();
    };

    // init palette from warm to white hot colors
    var initPalette = function()
    {
        palette = Array(256);

        for(i = 0; i < 64; i++)
        {
            palette[i] = rgbToColor((i << 2), 0, 0);
            palette[i + 64] = rgbToColor(255, (i << 2), 0);
            palette[i + 128] = rgbToColor(255, 255, (i << 2));
            palette[i + 192] = rgbToColor(255, 255, 255);
        }
    };

    // color map is a scaled map with values 0 - 255 corresponding
    // to palette values
    // this allows manipulation of the display colors without mucking with
    // large 32-bit color values directly
    //
    // cooling map is the same thing with small "cooling" values
    // to set areas of "cool" pixels
    var initCoolingMap = function()
    {
        for(x = 0; x < width / scale; x++)
        {
            for(y = 0; y < height / scale; y++)
            {
                coolingMap[toIndex(x, y)] = randomValue(5);
            }
        }

        for(x = 1; x < width / scale - 1; x++)
        {
            for(y = 1; y < height / scale - 1; y++)
            {
                var p = ~~((
                    coolingMap[toIndex(x, y - 1)] +
                    coolingMap[toIndex(x - 1, y)] +
                    coolingMap[toIndex(x + 1, y)] +
                    coolingMap[toIndex(x, y + 1)]) / 4);

                coolingMap[toIndex(x, y)] = p;
            }
        }
    };

    // offscreen buffer for rendering image masks for burning onscreen
    var initOffScreenContext = function()
    {
        var canvas = document.createElement('canvas');
        canvas.width = width / scale;
        canvas.height = width / scale;
        offScreenContext = canvas.getContext("2d");
    };

    // main render loop
    var update = function()
    {
        // draw two lines of random palette noise at bottom of screen
        for(x = 0; x < width / scale; x++)
        {
            colorMap[toIndex(x, height / scale)] = randomValue(palette.length);
            colorMap[toIndex(x, height / scale - 1)] = randomValue(palette.length);
        }

        smooth();
        draw();

        requestAnimFrame(function(){
            update();
        });
    };

    // take the middle pixel and average it with the surrounding pixels
    // then write it one veritcal pixel up
    //
    // v1|v2|v3
    // v4|**|v5
    // v6|v7|v8
    var smooth = function()
    {
        for(var x = 1; x < width / scale - 1; x++)
        {
            for(var y = interleave; y < height / scale; y+= 2)
            {
                // protip: a double bitwise not (~~) is much faster than
                // Math.floor() for truncating floating point values into "ints"
                var p = ~~((
                    colorMap[toIndex(x - 1, y - 1)] +
                    colorMap[toIndex(x, y - 1)] +
                    colorMap[toIndex(x + 1, y - 1)] +
                    colorMap[toIndex(x - 1, y)] +
                    colorMap[toIndex(x + 1, y)] +
                    colorMap[toIndex(x - 1, y + 1)] +
                    colorMap[toIndex(x, y + 1)] +
                    colorMap[toIndex(x + 1, y + 1)]) / 8);

                var cool = coolingMap[toIndex(x, y)] + fan;
                p = Math.max(0, p - cool);

                colorMap[toIndex(x, y - 1)] = p;
            }
        }
    };

    // draw colormap->palette values to screen
    var draw = function()
    {
        for(var x = 0; x < width / scale; x++)
        {
            for(var y = interleave; y < height / scale - slack; y+= 2)
            {
                var index = toIndex(x, y);
                var value = colorMap[index];
                
                if(value === null)
                    value = 0;
                
                // don't draw black pixels
                // speeds up framerate but leaves nasty artifacts sometimes
                if(value !== 0)
                    drawPixel(x, y, palette[value]);
            }
        }

        interleave = !interleave;
        frames++;
    };

    // not using the context.imageData to draw pixels
    // using fillRect allows for doubling "pixels" for increased framerate
    var drawPixel = function(x, y, color)
    {
        context.fillStyle = colorToString(color);
        context.fillRect(x * scale, y * scale, scale, scale);
    };

    var clear = function()
    {
        context.fillStyle = 'rgb(0, 0, 0)';
        context.fillRect(0, 0, width, height - (5 + slack));
    };

    var randomValue = function(max)
    {
        return Math.round(Math.random() * (max - 1));
    };

    // because "two-dimensional" arrays in JavaScript suck
    var toIndex = function(x, y)
    {
        return ~~((width * y + x) / scale);
    };

    // 24-bit color value from RGB components
    var rgbToColor = function(r, g, b)
    {
        return (r << 16 | g << 8 | b);
    };

    // 24-bit color value to string (example: #ff00ff)
    var colorToString = function(color)
    {
        return '#' + ('00000' + (color).toString(16)).slice(-6);
    };

    // burns an image to screen using a binary pixel map
    // if the map's pixel is white (on) a random palette color is burned into
    // that place onscreen
    this.drawOverlay = function(image)
    {
        clear();

        offScreenContext.drawImage(image, 0, 0, width / scale, height / scale);

        for(var x = 0; x < 0 + (width / scale); x++)
        {
            for(var y = 0; y < 0 + (height / scale); y++)
            {
                var data = offScreenContext.getImageData(x, y, 1, 1).data;
                var index = toIndex(x - 0, y - 0);

                if(data[0] == 255 && data[1] == 255 && data[2] == 255)
                    colorMap[index] = randomValue(palette.length);
                else
                    colorMap[index] = 0;
            }
        }
    };

    // draw a bunch of random embers onscreen
    this.drawEmbers = function()
    {
        for(var x = 1; x < width / scale - 1; x++)
        {
            for(var y = 1; y < height; y++)
            {
                if(randomValue(10) === 0)
                    colorMap[toIndex(x, y)] = randomValue(palette.length);
            }
        }
    };

    // fans the flames down
    this.fanDown = function()
    {
        fan = Math.min(5, fan + 1);
    };

    // fans the flame up
    this.fanUp = function()
    {
        fan = Math.max(-1, fan - 1);
    };

    this.framerate = function()
    {
        var now = new Date().getTime();
        var seconds = (now - start) / 1000;
        return Math.round(frames / seconds);
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