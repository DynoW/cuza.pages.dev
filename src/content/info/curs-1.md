---
title: "Curs-1"
description: "Suma cifrelor"
---

```cpp
s = 0;
while(n != 0){
    s = s + n % 10;
    n = n / 10;
}
```
sau
```cpp
s = 0;
while(n)
    s += n % 10, n /= 10;
```