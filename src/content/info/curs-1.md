---
title: "Curs-1"
description: "Suma cifrelor"
---

## Varianta I (explicită)

```cpp
s = 0;
while(n != 0){
    s = s + n % 10;
    n = n / 10;
}
```

## Varianta II (compactă)

```cpp
s = 0;
while(n)
    s += n % 10, n /= 10;
```
