---
title: "Curs-matrici-1"
description: "Declarare și citire de matrice"
---

## Ce înveți

- Cum declari o matrice bidimensională.
- Cum citești valorile unei matrice.
- Cum parcurgi elementele unei matrice.

## Declarare

```cpp
int m[100][100];  // matrice 100 x 100
int n, p;         // n = număr de linii, p = număr de coloane
```

## Citire de la tastatură

```cpp
cin >> n >> p;  // dimensiunile
for(i=0; i<n; i++)
    for(j=0; j<p; j++)
        cin >> m[i][j];
```

## Afișare

```cpp
for(i=0; i<n; i++){
    for(j=0; j<p; j++)
        cout << m[i][j] << " ";
    cout << "\n";
}
```
