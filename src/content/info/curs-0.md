---
title: 'Curs-0'
description: 'Citire de numere'
---

## Varianta I: citire până la `0`

```cpp
cin >> n;
while(n){
    // prelucrare n
    // ...
    cin >> n;
}
```

## Varianta II: citire a `n` numere

```cpp
cin >> n;
for(i=1;i<=n;i++){
    cin >> x;
    // prelucrare x
    // ...
}
```

## Varianta III: citire până la finalul fișierului (EOF)

```cpp
// ! Nu uita sa imporți librăria !
#include <fstream>
ifstream f("fisier.txt");
```

```cpp
while(f>>n){
    // prelucrare n
}
```
