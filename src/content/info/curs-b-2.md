---
title: "Curs-matrici-2"
description: "Suma și parcurgerea elementelor"
---

## Suma tuturor elementelor

```cpp
s = 0;
for(i=0; i<n; i++)
    for(j=0; j<p; j++)
        s += m[i][j];
```

## Suma unei linii

```cpp
s = 0;
for(j=0; j<p; j++)
    s += m[linie][j];
```

## Suma unei coloane

```cpp
s = 0;
for(i=0; i<n; i++)
    s += m[i][coloana];
```

## Maxim într-o linie

```cpp
max = m[linie][0];
for(j=0; j<p; j++)
    if(m[linie][j] > max)
        max = m[linie][j];
```

## Parcurgere după diagonale

```cpp
// diagonala d pornind din (0, d)
for(i=0; i<n && d+i < p; i++)
    cout << m[i][d+i] << " ";
```
