---
title: "Curs-2"
description: "Oglinditul/Inversul/Răsturnatul"
---

## Idee

Construim un nou număr, cifră cu cifră, luând mereu ultima cifră din `n`.

```cpp
ogl = 0;
while(n != 0){
    ogl = ogl * 10 + n % 10;
    n = n / 10;
}
```
