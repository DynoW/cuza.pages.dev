import React from 'react';

const data = await import.meta.glob(
    "/public/files/**/*.pdf"
);

const categories = {};

for (const file in data) {
    data[file]();
    const filePath = file.replace("/public/files/", "");
    const pathParts = filePath.split("/");

    let currentCategory = categories;

    pathParts.forEach((subDirectory, index) => {
        if (!currentCategory[subDirectory]) {
            if (index === pathParts.length - 1) {
                currentCategory[subDirectory] = pathParts;
            } else {
                currentCategory[subDirectory] = {};
            }
        }
        currentCategory = currentCategory[subDirectory];
    });
}

class Content extends React.Component {
    listDir(dict) {
        let Child = 0;
        if (typeof dict !== 'object' || dict === null || Array.isArray(dict)) {
            return null;
        }
        return (
            <ul className={this.props.page.includes('altele') ? "altele-list" : "content-list"}>
                {Object.entries(dict).reverse().map(([key, value]) => (
                    (typeof value !== 'object' || value === null || Array.isArray(value)) ? (
                        <li key={value[value.length - 1]}>
                            <a className={this.props.page.includes('altele') ? "altele-link" : "content-link"} href={"/files/" + value.join("/")} target="_blank">{value[value.length - 1]}</a>
                        </li>
                    ) : (
                        <li key={key.replace("-", " ")}>
                            <hr className={(++Child !== 1) ? "hidden" : "border-black mb-2"} />
                            <p className={this.props.page.includes('altele') ? "altele-text" : "content-text"}>{key.replace("-", " ")}</p>
                            {this.listDir(value)}
                        </li>
                    )
                ))}
            </ul>
        );
    }

    render() {
        const { subject, page } = this.props;
        if (!categories[subject] || !categories[subject][page]) {
            return <p>No content available.</p>;
        }
        return this.listDir(categories[subject][page]);
    }
}

export default Content;
