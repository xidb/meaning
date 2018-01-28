import React, { Component } from 'react';
import PropTypes from 'prop-types';

export default class Lyrics extends Component {
	constructor() {
		super();

		this.state = {lyrics: '', imagePath: 'assets/record.svg'};

		this.handleChange = this.handleChange.bind(this);
		this.handleSubmit = this.handleSubmit.bind(this);
	}

	static propTypes = {
		file: PropTypes.object,
		imagePath: PropTypes.string
	};

	componentWillReceiveProps(nextProps) {
		if (nextProps.file.lyrics !== this.state.lyrics && nextProps.imagePath !== this.state.imagePath) {
			this.setState({
				lyrics: nextProps.file.lyrics,
				imagePath: nextProps.imagePath,
			});
		}

		if (nextProps.file.lyrics !== this.state.lyrics) {
			this.setState({lyrics: nextProps.file.lyrics});
		}

		if (nextProps.imagePath !== this.state.imagePath) {
			this.setState({imagePath: nextProps.imagePath});
		}
	}

	handleChange(event) {
		this.setState({lyrics: event.target.value});
	}

	handleSubmit(event) {
		this.props.updateLyrics(this.props.file, this.state.lyrics);
		event.preventDefault();
	}

	render() {
		let { lyrics, imagePath } = this.state;
		const error = typeof lyrics === 'undefined'
			? 'Select a song...'
			: false;
		if (!lyrics) {
			lyrics = 'Nothing here...';
		}

		const lyricsTextElement = error
			? <div className="lyrics__text">{error}</div>
			: <textarea className="lyrics__text" value={lyrics} onChange={this.handleChange} />;

		return(
			<div className="lyrics" onSubmit={this.handleSubmit}>
				<div className="lyrics__buttons">
				</div>
				<form className="lyrics__text-container">
					<div className="lyrics__info">
						<div className="lyrics__image" style={{backgroundImage: `url(${imagePath})`}} />
						<div className="lyrics__services">
						</div>
					</div>
					{lyricsTextElement}
					<div className="lyrics__buttons--bottom">
						<input type="submit" value="Save" />
					</div>
				</form>
			</div>
		)
	}
}