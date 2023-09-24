---
title: "Curs-vectori-5"
description: "Interclasare"
---
(se aplică șirurior ordonate)

```cpp
i=0;
j=0;
k=0;
while(i<n && j<m){
    if(a[i]<b[j]){
        c[k]=a[i]; // sau c[k++]=a[i++]
        k++;
        i++;
    } else {
        c[k]=b[j]; // sau c[k++]=b[j++]
        k++;
        j++;
    }
    /*
    sau in loc de else {...} pt a nu repeta nr:
    
    if(a[i]>b[i]){
        c[k++]=b[j++];
    } else {
        c[k++]=a[i++];
        j++;
    }
    */
}
while(i<n){c[k]=a[i];k++;i++}
while(j<m){c[k]=b[j];k++;j++}
```
