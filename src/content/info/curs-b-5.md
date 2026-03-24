---
title: "Curs-matrici-5"
description: "Diagonala principală și secundară"
---

## Diagonala principală

Elementele unde `i == j`

```cpp
// parcurgere
for(i=0; i<n; i++)
    cout << m[i][i] << " ";

// suma
s = 0;
for(i=0; i<n; i++)
    s += m[i][i];

// produsul
p = 1;
for(i=0; i<n; i++)
    p *= m[i][i];
```

## Diagonala secundară

Elementele unde `i + j == n - 1` (pentru matrice n × n)

```cpp
// parcurgere
for(i=0; i<n; i++)
    cout << m[i][n-1-i] << " ";

// suma
s = 0;
for(i=0; i<n; i++)
    s += m[i][n-1-i];
```
