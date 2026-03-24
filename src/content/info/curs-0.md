---
title: "Curs-0"
description: "Citire de numere"
---

## Ce înveți

- Cum citești valori până la o condiție de oprire.
- Cum citești exact `n` valori.
- Cum citești din fișier până la final (EOF).

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