export function getRandomSelectionRect(rect, area) {
    let randomX, randomY;
  
    // Keep generating random positions until the rectangle fits within the area
    do {
      randomX = Math.random() * (area.width - rect.width) + area.x;
      randomY = Math.random() * (area.height - rect.height) + area.y;
    } while (
      randomX + rect.width > area.x + area.width || // Check if the rectangle goes out of bounds horizontally
      randomY + rect.height > area.y + area.height // Check if the rectangle goes out of bounds vertically
    );


    const newRect = {
        x: randomX,
        y: randomY,
        width: rect.width,
        height: rect.height,
    };

    return newRect;
  }
  