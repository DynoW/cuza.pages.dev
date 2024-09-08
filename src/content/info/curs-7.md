---
title: "Curs-7"
description: "Șirul lui Fibonacci"
---

```
    c  b  a
ex: 1, 1, 2, 3, 5, 8, 13, ...
      +  =
```

```cpp
if(n == 1){
    // n face parte
    // ...
} else {
    c = b = 1;
    a = 0;
    while(a < n){
        a = b + c;
        c = b;
        b = a;
    }
    if(n == a){
        // n face parte
        // ...
    }
}
```
